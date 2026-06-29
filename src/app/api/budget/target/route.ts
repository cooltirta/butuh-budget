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
    const { categoryId, targetType, targetAmount, targetMonth } = body;

    if (!categoryId) {
      return NextResponse.json({ error: 'Missing categoryId' }, { status: 400 });
    }

    // Verify budget access
    const member = await prisma.budgetMember.findFirst({
      where: { userId: session.userId },
    });

    if (!member) {
      return NextResponse.json({ error: 'No budget workspace found' }, { status: 404 });
    }

    const budgetId = member.budgetId;

    // Verify category belongs to this budget
    const category = await prisma.category.findFirst({
      where: {
        id: categoryId,
        categoryGroup: { budgetId },
      },
    });

    if (!category) {
      return NextResponse.json({ error: 'Category not found or unauthorized' }, { status: 404 });
    }

    // Update target fields
    const updatedCategory = await prisma.category.update({
      where: { id: categoryId },
      data: {
        targetType: targetType || null,
        targetAmount: targetAmount !== undefined && targetAmount !== null ? parseInt(targetAmount, 10) : null,
        targetMonth: targetMonth || null,
      },
    });

    // Create notification
    let notificationMsg = '';
    if (targetType) {
      const formattedAmount = "Rp " + Math.abs(parseInt(targetAmount, 10) / 100).toLocaleString('id-ID');
      notificationMsg = `${session.name} mengatur target untuk kategori ${category.name} menjadi ${formattedAmount}`;
    } else {
      notificationMsg = `${session.name} menghapus target untuk kategori ${category.name}`;
    }
    
    await createNotification(budgetId, notificationMsg);

    return NextResponse.json({ success: true, category: updatedCategory });
  } catch (error: any) {
    console.error('Error setting budget target:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
