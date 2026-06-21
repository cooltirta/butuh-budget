import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { createNotification } from '@/lib/notifications';

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's budget
    const member = await prisma.budgetMember.findFirst({
      where: { userId: session.userId },
    });

    if (!member) {
      return NextResponse.json({ error: 'No budget workspace found' }, { status: 404 });
    }

    const budgetId = member.budgetId;

    // Fetch accounts
    const accounts = await prisma.account.findMany({
      where: { budgetId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    // Fetch all transactions for this budget to calculate balances
    const transactions = await prisma.transaction.findMany({
      where: { budgetId },
    });

    // Calculate balance for each account
    const accountsWithBalances = accounts.map((acc) => {
      // Sum of transactions originating from this account
      const sourceSum = transactions
        .filter((tx) => tx.accountId === acc.id)
        .reduce((sum, tx) => sum + tx.amount, 0);

      // Sum of transfers received by this account
      // Note: transfer amounts are stored as negative (outflow from source account),
      // so we subtract them to make them positive inflows at the destination account.
      const destSum = transactions
        .filter((tx) => tx.toAccountId === acc.id)
        .reduce((sum, tx) => sum - tx.amount, 0);

      const balance = sourceSum + destSum;

      return {
        ...acc,
        balance, // in cents
      };
    });

    return NextResponse.json({ accounts: accountsWithBalances });
  } catch (error: any) {
    console.error('Error fetching accounts:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, type } = await req.json();
    if (!name || !type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const member = await prisma.budgetMember.findFirst({
      where: { userId: session.userId },
    });

    if (!member) {
      return NextResponse.json({ error: 'No budget workspace found' }, { status: 404 });
    }

    const budgetId = member.budgetId;

    const newAccount = await prisma.account.create({
      data: {
        budgetId,
        name,
        type,
        isActive: true,
      },
    });

    // Create notification
    await createNotification(
      budgetId,
      `${session.name} membuat rekening baru: ${name}`
    );

    return NextResponse.json({ success: true, account: newAccount });
  } catch (error: any) {
    console.error('Error creating account:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
