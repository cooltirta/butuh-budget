import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getBudgetSheet } from '@/lib/budget';

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

    return NextResponse.json({
      budgetId,
      budgetName: member.budget.name,
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

    return NextResponse.json({ success: true, monthlyBudget });
  } catch (error: any) {
    console.error('Error updating budget:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
