const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Create or get Users
  const ayah = await prisma.user.upsert({
    where: { id: 'user-ayah-id-static-2026' },
    update: {},
    create: {
      id: 'user-ayah-id-static-2026',
      name: 'Ayah',
    },
  });

  const bunda = await prisma.user.upsert({
    where: { id: 'user-bunda-id-static-2026' },
    update: {},
    create: {
      id: 'user-bunda-id-static-2026',
      name: 'Bunda',
    },
  });

  console.log(`Created users: ${ayah.name}, ${bunda.name}`);

  // 2. Create or get Budget
  const budget = await prisma.budget.upsert({
    where: { id: 'budget-shared-id-static-2026' },
    update: {
      name: 'WNAB Shared Budget',
    },
    create: {
      id: 'budget-shared-id-static-2026',
      name: 'WNAB Shared Budget',
    },
  });

  console.log(`Created budget: ${budget.name}`);

  // 3. Create members link
  await prisma.budgetMember.upsert({
    where: { budgetId_userId: { budgetId: budget.id, userId: ayah.id } },
    update: {},
    create: {
      budgetId: budget.id,
      userId: ayah.id,
      role: 'OWNER',
    },
  });

  await prisma.budgetMember.upsert({
    where: { budgetId_userId: { budgetId: budget.id, userId: bunda.id } },
    update: {},
    create: {
      budgetId: budget.id,
      userId: bunda.id,
      role: 'MEMBER',
    },
  });

  console.log('Budget members linked (co-managed).');

  // 4. Create accounts
  const bankAccount = await prisma.account.upsert({
    where: { id: 'acc-checking-id-static-2026' },
    update: {},
    create: {
      id: 'acc-checking-id-static-2026',
      budgetId: budget.id,
      name: 'Checking Account',
      type: 'CHECKING',
      isActive: true,
    },
  });

  const savingsAccount = await prisma.account.upsert({
    where: { id: 'acc-savings-id-static-2026' },
    update: {},
    create: {
      id: 'acc-savings-id-static-2026',
      budgetId: budget.id,
      name: 'Savings Account',
      type: 'SAVINGS',
      isActive: true,
    },
  });

  const ccAccount = await prisma.account.upsert({
    where: { id: 'acc-creditcard-id-static-2026' },
    update: {},
    create: {
      id: 'acc-creditcard-id-static-2026',
      budgetId: budget.id,
      name: 'Credit Card',
      type: 'CREDIT_CARD',
      isActive: true,
    },
  });

  console.log('Default accounts created.');

  // 5. Seed Category Groups & Categories
  const categoriesData = [
    {
      group: 'Immediate Obligations',
      categories: ['Rent/Mortgage', 'Groceries', 'Electric', 'Water', 'Internet'],
    },
    {
      group: 'True Expenses',
      categories: ['Auto Maintenance', 'Medical', 'Home Insurance', 'Taxes'],
    },
    {
      group: 'Quality of Life Goals',
      categories: ['Vacation', 'Dining Out', 'Entertainment', 'Fitness'],
    },
  ];

  let groupSort = 0;
  for (const item of categoriesData) {
    // Check if group exists under this budget
    let group = await prisma.categoryGroup.findFirst({
      where: { budgetId: budget.id, name: item.group },
    });

    if (!group) {
      group = await prisma.categoryGroup.create({
        data: {
          budgetId: budget.id,
          name: item.group,
          sortOrder: groupSort++,
        },
      });
    }

    let catSort = 0;
    for (const catName of item.categories) {
      // Check if category exists
      let category = await prisma.category.findFirst({
        where: { categoryGroupId: group.id, name: catName },
      });

      if (!category) {
        await prisma.category.create({
          data: {
            categoryGroupId: group.id,
            name: catName,
            sortOrder: catSort++,
          },
        });
      }
    }
  }

  console.log('Category groups and categories seeded.');

  // 6. Seed a few initial transactions so there is money in RTA and some activity
  // Check if we already have transactions to avoid duplicate seeding
  const txCount = await prisma.transaction.count({
    where: { budgetId: budget.id },
  });

  if (txCount === 0) {
    const today = new Date();
    // Starting balance Checking: Inflow of $5,000 (500000 cents) to RTA (categoryId = null)
    await prisma.transaction.create({
      data: {
        budgetId: budget.id,
        accountId: bankAccount.id,
        date: today,
        payee: 'Starting Balance (Checking)',
        categoryId: null, // Income to RTA
        memo: 'Salary for June',
        amount: 500000,
        cleared: true,
      },
    });

    // Starting balance Savings: Inflow of $10,000 (1000000 cents) to RTA
    await prisma.transaction.create({
      data: {
        budgetId: budget.id,
        accountId: savingsAccount.id,
        date: today,
        payee: 'Starting Balance (Savings)',
        categoryId: null,
        memo: 'Emergency Funds',
        amount: 1000000,
        cleared: true,
      },
    });

    // Find Rent/Mortgage and Groceries to assign some initial monthly budget and spendings
    const rentCat = await prisma.category.findFirst({
      where: { categoryGroup: { budgetId: budget.id }, name: 'Rent/Mortgage' },
    });
    const groceryCat = await prisma.category.findFirst({
      where: { categoryGroup: { budgetId: budget.id }, name: 'Groceries' },
    });

    const monthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;

    if (rentCat && groceryCat) {
      // Assign budget
      await prisma.monthlyBudget.createMany({
        data: [
          {
            budgetId: budget.id,
            categoryId: rentCat.id,
            month: monthStr,
            assigned: 150000, // $1,500
          },
          {
            budgetId: budget.id,
            categoryId: groceryCat.id,
            month: monthStr,
            assigned: 50000, // $500
          },
        ],
      });

      // Spend money on Groceries (-$82.50 = -8250 cents)
      await prisma.transaction.create({
        data: {
          budgetId: budget.id,
          accountId: bankAccount.id,
          date: today,
          payee: 'Supermarket',
          categoryId: groceryCat.id,
          memo: 'Weekly Groceries',
          amount: -8250,
          cleared: true,
        },
      });

      // Spend money on Rent (-$1500.00 = -150000 cents)
      await prisma.transaction.create({
        data: {
          budgetId: budget.id,
          accountId: bankAccount.id,
          date: today,
          payee: 'Landlord',
          categoryId: rentCat.id,
          memo: 'Rent payment',
          amount: -150000,
          cleared: true,
        },
      });
    }

    console.log('Initial transactions seeded.');
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
