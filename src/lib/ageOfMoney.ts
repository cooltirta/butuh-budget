import { prisma } from './db';
import { AccountType } from '@prisma/client';

export async function calculateAgeOfMoney(budgetId: string): Promise<number> {
  try {
    // 1. Fetch all active accounts for this budget
    const accounts = await prisma.account.findMany({
      where: { budgetId },
    });

    const accountTypeMap: Record<string, AccountType> = {};
    for (const acc of accounts) {
      accountTypeMap[acc.id] = acc.type;
    }

    // Cash accounts are checking, savings, and cash (exclude credit card)
    const isCash = (type: AccountType) =>
      type === AccountType.CHECKING ||
      type === AccountType.SAVINGS ||
      type === AccountType.CASH;

    // 2. Fetch all transactions for this budget, ordered chronologically
    const txs = await prisma.transaction.findMany({
      where: { budgetId },
      orderBy: [
        { date: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    interface CashPacket {
      amount: number;
      date: Date;
    }

    const queue: CashPacket[] = [];
    const outflowAges: number[] = []; // holds the average age of money for each outflow event

    for (const tx of txs) {
      const fromCash = isCash(accountTypeMap[tx.accountId]);
      const toCash = tx.toAccountId ? isCash(accountTypeMap[tx.toAccountId]) : false;

      let inflowAmount = 0;
      let outflowAmount = 0;

      if (!tx.toAccountId) {
        // Regular transaction
        if (fromCash) {
          if (tx.amount > 0) {
            inflowAmount = tx.amount;
          } else if (tx.amount < 0) {
            outflowAmount = Math.abs(tx.amount);
          }
        }
      } else {
        // Transfer
        if (fromCash && toCash) {
          // Internal cash transfer: does not change the net cash pool size, ignore
        } else if (fromCash && !toCash) {
          // Cash to non-cash (e.g. paying credit card bill)
          outflowAmount = Math.abs(tx.amount);
        } else if (!fromCash && toCash) {
          // Non-cash to cash (e.g. cash advance from credit card or transfer from tracking)
          inflowAmount = Math.abs(tx.amount);
        }
      }

      if (inflowAmount > 0) {
        queue.push({ amount: inflowAmount, date: new Date(tx.date) });
      }

      if (outflowAmount > 0) {
        let remaining = outflowAmount;
        let totalAgeWeighted = 0;
        let totalDequeued = 0;

        const txDate = new Date(tx.date);

        while (remaining > 0 && queue.length > 0) {
          const front = queue[0];
          const ageDays = Math.max(0, (txDate.getTime() - front.date.getTime()) / (1000 * 60 * 60 * 24));

          if (front.amount <= remaining) {
            totalAgeWeighted += front.amount * ageDays;
            totalDequeued += front.amount;
            remaining -= front.amount;
            queue.shift();
          } else {
            totalAgeWeighted += remaining * ageDays;
            totalDequeued += remaining;
            front.amount -= remaining;
            remaining = 0;
          }
        }

        if (totalDequeued > 0) {
          const avgAge = totalAgeWeighted / totalDequeued;
          outflowAges.push(avgAge);
        }
      }
    }

    if (outflowAges.length === 0) return 0;

    // Take the average of the last 10 outflows
    const lastOutflows = outflowAges.slice(-10);
    const sum = lastOutflows.reduce((s, val) => s + val, 0);
    return Math.round(sum / lastOutflows.length);
  } catch (error) {
    console.error('Error calculating Age of Money:', error);
    return 0;
  }
}
