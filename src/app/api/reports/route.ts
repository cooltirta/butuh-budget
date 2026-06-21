import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const member = await prisma.budgetMember.findFirst({
      where: { userId: session.userId },
    });

    if (!member) {
      return NextResponse.json({ error: 'No budget workspace found' }, { status: 404 });
    }

    const budgetId = member.budgetId;

    // Fetch accounts, transactions, and category groups
    const accounts = await prisma.account.findMany({
      where: { budgetId, isActive: true },
    });

    const transactions = await prisma.transaction.findMany({
      where: { budgetId },
      include: {
        category: {
          include: {
            categoryGroup: true,
          },
        },
      },
    });

    const categoryGroups = await prisma.categoryGroup.findMany({
      where: { budgetId },
    });

    // We will compute data for the last 6 months
    const today = new Date();
    const last6Months: { name: string; date: Date }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const name = d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
      last6Months.push({ name, date: d });
    }

    // 1. Calculate Net Worth History (Asset vs Debt)
    const netWorthHistory = last6Months.map((m) => {
      const monthEnd = new Date(m.date.getFullYear(), m.date.getMonth() + 1, 0, 23, 59, 59, 999);

      let assets = 0;
      let debt = 0;

      accounts.forEach((acc) => {
        // Calculate account balance up to monthEnd
        const sourceSum = transactions
          .filter((tx) => tx.accountId === acc.id && tx.date <= monthEnd)
          .reduce((sum, tx) => sum + tx.amount, 0);

        const destSum = transactions
          .filter((tx) => tx.toAccountId === acc.id && tx.date <= monthEnd)
          .reduce((sum, tx) => sum - tx.amount, 0);

        const balance = sourceSum + destSum;

        if (acc.type === 'CREDIT_CARD') {
          // Debt is positive value in chart
          debt += Math.abs(balance < 0 ? balance : 0);
        } else {
          assets += balance > 0 ? balance : 0;
        }
      });

      return {
        month: m.name,
        assets: Math.round(assets / 100),
        debt: Math.round(debt / 100),
        netWorth: Math.round((assets - debt) / 100),
      };
    });

    // 2. Calculate Spending by Category Group (for current month)
    const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const currentMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

    const currentMonthTxs = transactions.filter(
      (tx) => tx.date >= currentMonthStart && tx.date <= currentMonthEnd
    );

    const spendingByCategoryGroup = categoryGroups.map((cg) => {
      // Get all outflows (negative amounts) in this group's categories
      const groupSpending = currentMonthTxs
        .filter((tx) => tx.category?.categoryGroup.id === cg.id && tx.amount < 0)
        .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

      return {
        name: cg.name,
        value: Math.round(groupSpending / 100),
      };
    }).filter((item) => item.value > 0); // Only return groups with spending

    // 3. Calculate Income vs. Expense history (last 6 months)
    const incomeVsExpense = last6Months.map((m) => {
      const mStart = new Date(m.date.getFullYear(), m.date.getMonth(), 1);
      const mEnd = new Date(m.date.getFullYear(), m.date.getMonth() + 1, 0, 23, 59, 59, 999);

      const mTxs = transactions.filter((tx) => tx.date >= mStart && tx.date <= mEnd);

      // Income = regular positive transactions to RTA (categoryId is null and amount > 0)
      const income = mTxs
        .filter((tx) => tx.categoryId === null && tx.amount > 0)
        .reduce((sum, tx) => sum + tx.amount, 0);

      // Expense = regular negative transactions assigned to category
      const expense = mTxs
        .filter((tx) => tx.categoryId !== null && tx.amount < 0)
        .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

      return {
        month: m.name,
        income: Math.round(income / 100),
        expense: Math.round(expense / 100),
      };
    });

    return NextResponse.json({
      netWorthHistory,
      spendingByCategoryGroup,
      incomeVsExpense,
    });
  } catch (error: any) {
    console.error('Error generating reports data:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
