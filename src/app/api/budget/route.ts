import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getBudgetSheet } from '@/lib/budget';
import { createNotification } from '@/lib/notifications';
import { calculateAgeOfMoney } from '@/lib/ageOfMoney';

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const month = searchParams.get('month');

    if (!month || !/^\d{4}-\d{2}-01$/.test(month)) {
      return NextResponse.json({ error: 'Invalid month format (expected YYYY-MM-01)' }, { status: 400 });
    }

    // Get the user's budget (shared budget)
    const member = await prisma.budgetMember.findFirst({
      where: { userId: session.userId },
      include: { budget: true },
    });

    if (!member) {
      return NextResponse.json({ error: 'No budget workspace found for user' }, { status: 404 });
    }

    const budgetId = member.budgetId;
    const budgetSheet = await getBudgetSheet(budgetId, month);
    const ageOfMoney = await calculateAgeOfMoney(budgetId);

    return NextResponse.json({
      budgetId,
      budgetName: member.budget.name,
      ageOfMoney,
      ...budgetSheet,
    });
  } catch (error: any) {
    console.error('Error fetching budget:', error);
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
    const { categoryId, month, assigned } = body; // assigned in cents

    if (!categoryId || !month || assigned === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!/^\d{4}-\d{2}-01$/.test(month)) {
      return NextResponse.json({ error: 'Invalid month format' }, { status: 400 });
    }

    // Get budget member
    const member = await prisma.budgetMember.findFirst({
      where: { userId: session.userId },
    });

    if (!member) {
      return NextResponse.json({ error: 'No budget workspace found' }, { status: 404 });
    }

    const budgetId = member.budgetId;

    // Get category name
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
    });

    const categoryName = category ? category.name : 'Kategori';

    // Upsert monthly budget allocation
    const monthlyBudget = await prisma.monthlyBudget.upsert({
      where: {
        budgetId_categoryId_month: {
          budgetId,
          categoryId,
          month,
        },
      },
      update: {
        assigned: parseInt(assigned, 10),
      },
      create: {
        budgetId,
        categoryId,
        month,
        assigned: parseInt(assigned, 10),
      },
    });

    // Create notification
    const formattedAmount = "Rp " + Math.abs(parseInt(assigned, 10) / 100).toLocaleString('id-ID');
    const monthLabel = new Date(month).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    await createNotification(
      budgetId,
      `${session.name} mengubah anggaran ${categoryName} untuk bulan ${monthLabel} menjadi ${formattedAmount}`
    );

    return NextResponse.json({ success: true, monthlyBudget });
  } catch (error: any) {
    console.error('Error updating budget:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
