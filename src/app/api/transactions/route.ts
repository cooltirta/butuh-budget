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

    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get('accountId');

    const member = await prisma.budgetMember.findFirst({
      where: { userId: session.userId },
    });

    if (!member) {
      return NextResponse.json({ error: 'No budget workspace found' }, { status: 404 });
    }

    const budgetId = member.budgetId;

    // Build filter
    let whereClause: any = { budgetId };

    if (accountId) {
      // Return transactions where this account is either the source or the destination of a transfer
      whereClause = {
        budgetId,
        OR: [
          { accountId },
          { toAccountId: accountId }
        ]
      };
    }

    const transactions = await prisma.transaction.findMany({
      where: whereClause,
      include: {
        account: true,
        toAccount: true,
        category: {
          include: {
            categoryGroup: true
          }
        }
      },
      orderBy: { date: 'desc' },
    });

    return NextResponse.json({ transactions });
  } catch (error: any) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { date, payee, accountId, toAccountId, categoryId, memo, amount, cleared } = body;

    if (!date || !payee || !accountId || amount === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const member = await prisma.budgetMember.findFirst({
      where: { userId: session.userId },
    });

    if (!member) {
      return NextResponse.json({ error: 'No budget workspace found' }, { status: 404 });
    }

    const budgetId = member.budgetId;

    const newTx = await prisma.transaction.create({
      data: {
        budgetId,
        accountId,
        toAccountId: toAccountId || null,
        date: new Date(date),
        payee,
        categoryId: categoryId || null,
        memo: memo || '',
        amount: parseInt(amount, 10),
        cleared: !!cleared,
      },
    });

    // Create notification
    const formatRupiah = (c: number) => "Rp " + Math.abs(c / 100).toLocaleString('id-ID');
    const amountInt = parseInt(amount, 10);
    
    if (toAccountId) {
      const srcAcc = await prisma.account.findUnique({ where: { id: accountId } });
      const destAcc = await prisma.account.findUnique({ where: { id: toAccountId } });
      await createNotification(
        budgetId,
        `${session.name} mentransfer ${formatRupiah(amountInt)} dari ${srcAcc?.name || 'Rekening'} ke ${destAcc?.name || 'Rekening'}`
      );
    } else {
      let catName = 'Siap Dialokasikan';
      if (categoryId) {
        const cat = await prisma.category.findUnique({ where: { id: categoryId } });
        if (cat) catName = cat.name;
      }
      await createNotification(
        budgetId,
        `${session.name} mencatat ${amountInt < 0 ? 'pengeluaran' : 'pemasukan'} ${formatRupiah(amountInt)} untuk "${payee}" (${catName})`
      );
    }

    return NextResponse.json({ success: true, transaction: newTx });
  } catch (error: any) {
    console.error('Error creating transaction:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing transaction ID' }, { status: 400 });
    }

    const member = await prisma.budgetMember.findFirst({
      where: { userId: session.userId },
    });

    if (!member) {
      return NextResponse.json({ error: 'No budget workspace found' }, { status: 404 });
    }

    // Verify transaction belongs to this budget
    const tx = await prisma.transaction.findFirst({
      where: { id, budgetId: member.budgetId },
    });

    if (!tx) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    if (tx.reconciled) {
      return NextResponse.json({ error: 'Transaksi telah direkonsiliasi dan tidak dapat dihapus.' }, { status: 400 });
    }

    await prisma.transaction.delete({
      where: { id },
    });

    // Create notification
    const formatRupiah = (c: number) => "Rp " + Math.abs(c / 100).toLocaleString('id-ID');
    await createNotification(
      member.budgetId,
      `${session.name} menghapus transaksi ${formatRupiah(tx.amount)} untuk "${tx.payee}"`
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting transaction:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
