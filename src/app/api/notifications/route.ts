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

    const notifications = await prisma.notification.findMany({
      where: { budgetId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Mark active if user id is not in readBy array
    const unreadCount = notifications.filter(
      (n) => !n.readBy.includes(session.userId)
    ).length;

    return NextResponse.json({ notifications, unreadCount });
  } catch (error: any) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
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

    // Fetch unread notifications for this budget
    const unreadNotifications = await prisma.notification.findMany({
      where: {
        budgetId,
        NOT: {
          readBy: {
            has: session.userId,
          },
        },
      },
    });

    // Update each notification to append the userId to readBy array
    for (const notif of unreadNotifications) {
      await prisma.notification.update({
        where: { id: notif.id },
        data: {
          readBy: {
            set: [...notif.readBy, session.userId],
          },
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error reading notifications:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
