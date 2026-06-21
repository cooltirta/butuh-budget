import { prisma } from './db';

export async function createNotification(budgetId: string, message: string) {
  try {
    return await prisma.notification.create({
      data: {
        budgetId,
        message,
        readBy: [],
      },
    });
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
}
