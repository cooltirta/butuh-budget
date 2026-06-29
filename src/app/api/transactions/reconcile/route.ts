import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { createNotification } from '@/lib/notifications';

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { accountId, actualBalance } = body; // actualBalance in cents

    if (!accountId || actualBalance === undefined) {
      return NextResponse.json({ error: 'Missing accountId or actualBalance' }, { status: 400 });
    }

    // Verify budget access
    const member = await prisma.budgetMember.findFirst({
      where: { userId: session.userId },
    });

    if (!member) {
      return NextResponse.json({ error: 'No budget workspace found' }, { status: 404 });
    }

    const budgetId = member.budgetId;

    // Verify account belongs to budget
    const account = await prisma.account.findFirst({
      where: { id: accountId, budgetId },
    });

    if (!account) {
      return NextResponse.json({ error: 'Account not found or unauthorized' }, { status: 404 });
    }

    // Fetch all transactions for this budget to calculate current cleared balance
    const transactions = await prisma.transaction.findMany({
      where: { budgetId },
    });

    // Calculate current cleared balance for this specific account
    const sourceSum = transactions
      .filter((tx) => tx.accountId === accountId)
      .reduce((sum, tx) => sum + tx.amount, 0);

    const destSum = transactions
      .filter((tx) => tx.toAccountId === accountId)
      .reduce((sum, tx) => sum - tx.amount, 0);

    const clearedBalance = sourceSum + destSum;
    const difference = actualBalance - clearedBalance;

    let adjustmentTx = null;

    if (difference !== 0) {
      // Create reconciliation adjustment transaction
      adjustmentTx = await prisma.transaction.create({
        data: {
          budgetId,
          accountId,
          date: new Date(),
          payee: 'Penyesuaian Rekonsiliasi',
          memo: 'Disesuaikan otomatis oleh sistem saat rekonsiliasi',
          amount: difference,
          cleared: true,
          reconciled: true,
        },
      });
    }

    // Lock/reconcile all cleared transactions for this account
    await prisma.transaction.updateMany({
      where: {
        budgetId,
        cleared: true,
        reconciled: false,
        OR: [
          { accountId },
          { toAccountId: accountId }
        ]
      },
      data: {
        reconciled: true,
      },
    });

    // Create notification log
    const formattedBalance = "Rp " + (actualBalance / 100).toLocaleString('id-ID');
    await createNotification(
      budgetId,
      `${session.name} merekonsiliasi rekening "${account.name}" dengan saldo ${formattedBalance}`
    );

    return NextResponse.json({
      success: true,
      adjustmentCreated: difference !== 0,
      adjustment: adjustmentTx,
    });
  } catch (error: any) {
    console.error('Error reconciling account:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
