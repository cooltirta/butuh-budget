import { prisma } from './db';

export interface CategoryBudgetInfo {
  id: string;
  name: string;
  assigned: number;  // in cents
  activity: number;  // in cents
  available: number; // in cents
}

export interface CategoryGroupInfo {
  id: string;
  name: string;
  categories: CategoryBudgetInfo[];
}

export async function getBudgetSheet(budgetId: string, targetMonthStr: string) {
  // targetMonthStr is in format YYYY-MM-01
  const targetDate = new Date(targetMonthStr);
  const targetYear = targetDate.getFullYear();
  const targetMonth = targetDate.getMonth(); // 0-indexed

  // 1. Fetch category groups & categories
  const categoryGroups = await prisma.categoryGroup.findMany({
    where: { budgetId },
    include: {
      categories: {
        orderBy: { sortOrder: 'asc' },
      },
    },
    orderBy: { sortOrder: 'asc' },
  });

  // 2. Fetch all monthly budgets up to the target month
  const monthlyBudgets = await prisma.monthlyBudget.findMany({
    where: { budgetId },
  });

  // 3. Fetch all transactions up to target month end
  // We need to calculate activity in the target month AND rollover available from previous months.
  // So we fetch all transactions up to the end of targetMonth.
  const targetMonthEnd = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);
  const transactions = await prisma.transaction.findMany({
    where: {
      budgetId,
      date: {
        lte: targetMonthEnd,
      },
    },
  });

  // 4. Calculate RTA (Ready to Assign)
  // RTA = (All inflows to RTA - i.e., categoryId is null) - (All assigned of all time)
  // Wait, does future assignment reduce current RTA? Yes, in YNAB it does.
  const rtaInflows = transactions
    .filter((tx) => tx.categoryId === null && tx.amount > 0)
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalAssigned = monthlyBudgets.reduce((sum, mb) => sum + mb.assigned, 0);
  const readyToAssign = rtaInflows - totalAssigned;

  // Let's generate a list of months to compute rollover month-by-month.
  // We need to find the earliest month with data (transaction or budget assignment)
  let earliestDate = new Date(targetYear, targetMonth, 1);
  for (const tx of transactions) {
    if (tx.date < earliestDate) earliestDate = new Date(tx.date.getFullYear(), tx.date.getMonth(), 1);
  }
  for (const mb of monthlyBudgets) {
    const mbDate = new Date(mb.month);
    if (mbDate < earliestDate) earliestDate = mbDate;
  }

  // Generate array of month strings from earliest to targetMonth
  const monthsSequence: string[] = [];
  let curr = new Date(earliestDate);
  const end = new Date(targetYear, targetMonth, 1);
  while (curr <= end) {
    monthsSequence.push(`${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}-01`);
    curr.setMonth(curr.getMonth() + 1);
  }

  // Map to hold cumulative available balances per category
  // categoryId -> available balance in cents
  const categoryAvailableMap: Record<string, number> = {};

  // Initialize all categories with 0 available
  const allCategories = categoryGroups.flatMap((cg) => cg.categories);
  for (const cat of allCategories) {
    categoryAvailableMap[cat.id] = 0;
  }

  // Let's store results for the target month specifically
  const targetMonthInfo: Record<string, { assigned: number; activity: number; available: number }> = {};
  for (const cat of allCategories) {
    targetMonthInfo[cat.id] = { assigned: 0, activity: 0, available: 0 };
  }

  // Roll over month-by-month
  for (const monthStr of monthsSequence) {
    const isTargetMonth = monthStr === targetMonthStr;

    // Filter transactions in this month
    const mDate = new Date(monthStr);
    const mStart = new Date(mDate.getFullYear(), mDate.getMonth(), 1);
    const mEnd = new Date(mDate.getFullYear(), mDate.getMonth() + 1, 0, 23, 59, 59, 999);

    const mTransactions = transactions.filter((tx) => tx.date >= mStart && tx.date <= mEnd);

    for (const cat of allCategories) {
      // Find assignment for this category in this month
      const assignmentObj = monthlyBudgets.find((mb) => mb.categoryId === cat.id && mb.month === monthStr);
      const assigned = assignmentObj ? assignmentObj.assigned : 0;

      // Find activity (sum of transaction amounts in this category in this month)
      // Note: outflow is negative, inflow is positive
      const activity = mTransactions
        .filter((tx) => tx.categoryId === cat.id)
        .reduce((sum, tx) => sum + tx.amount, 0);

      // Available = PrevAvailable + Assigned + Activity
      const prevAvailable = categoryAvailableMap[cat.id] || 0;
      let available = prevAvailable + assigned + activity;

      // In YNAB, if a category is overspent (negative):
      // Cash overspending (checking/cash) does not roll over to next month (it resets to 0 and is deducted from RTA).
      // For simplicity, we roll it over, but we can also cap it if desired. Let's just roll it over for now, as it's standard double-entry envelope tracking.
      categoryAvailableMap[cat.id] = available;

      if (isTargetMonth) {
        targetMonthInfo[cat.id] = {
          assigned,
          activity,
          available,
        };
      }
    }
  }

  // 5. Structure the return object
  const sheet: CategoryGroupInfo[] = categoryGroups.map((cg) => ({
    id: cg.id,
    name: cg.name,
    categories: cg.categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      assigned: targetMonthInfo[cat.id]?.assigned || 0,
      activity: targetMonthInfo[cat.id]?.activity || 0,
      available: targetMonthInfo[cat.id]?.available || 0,
    })),
  }));

  // Calculate overall target month summaries
  const totalBudgeted = Object.values(targetMonthInfo).reduce((sum, info) => sum + info.assigned, 0);
  const totalActivity = Object.values(targetMonthInfo).reduce((sum, info) => sum + info.activity, 0);
  const totalAvailable = Object.values(targetMonthInfo).reduce((sum, info) => sum + info.available, 0);

  return {
    readyToAssign,
    totalBudgeted,
    totalActivity,
    totalAvailable,
    categoryGroups: sheet,
  };
}
