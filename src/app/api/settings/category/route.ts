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

    // Create notification
    await createNotification(
      member.budgetId,
      `${session.name} membuat kategori baru: "${name}" di bawah grup "${group.name}"`
    );

    return NextResponse.json({ success: true, category: newCategory });
  } catch (error: any) {
    console.error('Error creating category:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, name } = await req.json();
    if (!id || !name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const member = await prisma.budgetMember.findFirst({
      where: { userId: session.userId },
    });

    if (!member) {
      return NextResponse.json({ error: 'No budget workspace found' }, { status: 404 });
    }

    const category = await prisma.category.findFirst({
      where: {
        id,
        categoryGroup: { budgetId: member.budgetId },
      },
    });

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    const updatedCategory = await prisma.category.update({
      where: { id },
      data: { name },
    });

    await createNotification(
      member.budgetId,
      `${session.name} mengubah nama kategori "${category.name}" menjadi "${name}"`
    );

    return NextResponse.json({ success: true, category: updatedCategory });
  } catch (error: any) {
    console.error('Error updating category:', error);
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
      return NextResponse.json({ error: 'Missing category ID' }, { status: 400 });
    }

    const member = await prisma.budgetMember.findFirst({
      where: { userId: session.userId },
    });

    if (!member) {
      return NextResponse.json({ error: 'No budget workspace found' }, { status: 404 });
    }

    const category = await prisma.category.findFirst({
      where: {
        id,
        categoryGroup: { budgetId: member.budgetId },
      },
    });

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    await prisma.category.delete({
      where: { id },
    });

    await createNotification(
      member.budgetId,
      `${session.name} menghapus kategori "${category.name}"`
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting category:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
