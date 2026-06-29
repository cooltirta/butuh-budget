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

    const { name } = await req.json();
    if (!name) {
      return NextResponse.json({ error: 'Missing category group name' }, { status: 400 });
    }

    const member = await prisma.budgetMember.findFirst({
      where: { userId: session.userId },
    });

    if (!member) {
      return NextResponse.json({ error: 'No budget workspace found' }, { status: 404 });
    }

    const budgetId = member.budgetId;

    // Get max sort order
    const maxSort = await prisma.categoryGroup.aggregate({
      where: { budgetId },
      _max: { sortOrder: true },
    });

    const sortOrder = (maxSort._max.sortOrder ?? -1) + 1;

    const newGroup = await prisma.categoryGroup.create({
      data: {
        budgetId,
        name,
        sortOrder,
      },
    });

    // Create notification
    await createNotification(
      budgetId,
      `${session.name} membuat grup kategori baru: "${name}"`
    );

    return NextResponse.json({ success: true, categoryGroup: newGroup });
  } catch (error: any) {
    console.error('Error creating category group:', error);
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

    const group = await prisma.categoryGroup.findFirst({
      where: { id, budgetId: member.budgetId },
    });

    if (!group) {
      return NextResponse.json({ error: 'Category group not found' }, { status: 404 });
    }

    const updatedGroup = await prisma.categoryGroup.update({
      where: { id },
      data: { name },
    });

    await createNotification(
      member.budgetId,
      `${session.name} mengubah nama grup kategori "${group.name}" menjadi "${name}"`
    );

    return NextResponse.json({ success: true, categoryGroup: updatedGroup });
  } catch (error: any) {
    console.error('Error updating category group:', error);
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
      return NextResponse.json({ error: 'Missing category group ID' }, { status: 400 });
    }

    const member = await prisma.budgetMember.findFirst({
      where: { userId: session.userId },
    });

    if (!member) {
      return NextResponse.json({ error: 'No budget workspace found' }, { status: 404 });
    }

    const group = await prisma.categoryGroup.findFirst({
      where: { id, budgetId: member.budgetId },
    });

    if (!group) {
      return NextResponse.json({ error: 'Category group not found' }, { status: 404 });
    }

    await prisma.categoryGroup.delete({
      where: { id },
    });

    await createNotification(
      member.budgetId,
      `${session.name} menghapus grup kategori "${group.name}"`
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting category group:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
