import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Get budgets this user has access to
  const members = await prisma.budgetMember.findMany({
    where: { userId: user.id },
    include: { budget: true },
  });

  const budgets = members.map((m) => m.budget);

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
    },
    budgets,
  });
}
