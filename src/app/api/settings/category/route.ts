import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, categoryGroupId } = await req.json();
    if (!name || !categoryGroupId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify category group belongs to the user's budget
    const member = await prisma.budgetMember.findFirst({
      where: { userId: session.userId },
    });

    if (!member) {
      return NextResponse.json({ error: 'No budget workspace found' }, { status: 404 });
    }

    const group = await prisma.categoryGroup.findFirst({
      where: { id: categoryGroupId, budgetId: member.budgetId },
    });

    if (!group) {
      return NextResponse.json({ error: 'Category group not found' }, { status: 404 });
    }

    // Get max sort order
    const maxSort = await prisma.category.aggregate({
      where: { categoryGroupId },
      _max: { sortOrder: true },
    });

    const sortOrder = (maxSort._max.sortOrder ?? -1) + 1;

    const newCategory = await prisma.category.create({
      data: {
        categoryGroupId,
        name,
        sortOrder,
      },
    });

    return NextResponse.json({ success: true, category: newCategory });
  } catch (error: any) {
    console.error('Error creating category:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
