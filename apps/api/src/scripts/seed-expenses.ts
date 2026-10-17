import { MongoClient, ObjectId } from 'mongodb';
import 'dotenv/config';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/campus_verse';

async function seedExpenses() {
  console.log('💰 Seeding expense & budget data...');

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db();

    const user = await db.collection('users').findOne({ email: 'orgdev@yopmail.com' });
    if (!user) {
      console.error('❌ User not found');
      return;
    }

    const tenantId = user.tenantId;
    const branch = await db.collection('branches').findOne({ tenantId, status: 'active' });
    if (!branch) {
      console.error('❌ No branch found');
      return;
    }

    const branchId = branch._id;
    const createdBy = user._id;
    const userName = user.profile?.firstName
      ? `${user.profile.firstName} ${user.profile.lastName || ''}`.trim()
      : user.email;

    console.log(`✅ Tenant: ${tenantId}, Branch: ${branch.name}, User: ${userName}`);

    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);

    // ── Helper: get next sequence ──
    const nextSeq = async (type: string, pad: number) => {
      const result = await db
        .collection('counters')
        .findOneAndUpdate(
          { tenantId, branchId, type },
          { $inc: { sequence: 1 }, $setOnInsert: { tenantId, branchId, type } },
          { upsert: true, returnDocument: 'after' }
        );
      return String(result!.sequence).padStart(pad, '0');
    };

    // ── Budgets ──
    console.log('📊 Creating budgets...');

    const budgetDefs = [
      {
        name: 'IT Infrastructure Budget',
        category: 'equipment',
        department: 'IT',
        allocated: 500000,
        spent: 178000,
        period: { start: '2026-04-01', end: '2027-03-31' },
      },
      {
        name: 'Campus Maintenance Budget',
        category: 'maintenance',
        department: 'Maintenance',
        allocated: 300000,
        spent: 95000,
        period: { start: '2026-04-01', end: '2027-03-31' },
      },
      {
        name: 'Staff Travel Budget',
        category: 'travel',
        department: 'Administration',
        allocated: 200000,
        spent: 62000,
        period: { start: '2026-04-01', end: '2027-03-31' },
      },
      {
        name: 'Annual Events Budget',
        category: 'events',
        department: 'Student Affairs',
        allocated: 400000,
        spent: 145000,
        period: { start: '2026-04-01', end: '2027-03-31' },
      },
      {
        name: 'Lab Supplies Budget',
        category: 'supplies',
        department: 'Science',
        allocated: 150000,
        spent: 148500,
        period: { start: '2026-04-01', end: '2027-03-31' },
      },
      {
        name: 'Utility Bills Budget',
        category: 'utilities',
        department: 'Administration',
        allocated: 600000,
        spent: 210000,
        period: { start: '2026-04-01', end: '2027-03-31' },
      },
    ];

    const budgetIds: Record<string, ObjectId> = {};

    for (const b of budgetDefs) {
      const remaining = b.allocated - b.spent;
      const result = await db.collection('budgets').insertOne({
        tenantId,
        branchId,
        name: b.name,
        description: null,
        category: b.category,
        department: b.department,
        academicBatchId: null,
        allocated: b.allocated,
        spent: b.spent,
        remaining,
        period: { startDate: new Date(b.period.start), endDate: new Date(b.period.end) },
        status: remaining <= 0 ? 'exhausted' : 'active',
        createdBy,
        createdAt: now,
        updatedAt: now,
      });
      budgetIds[b.category] = result.insertedId;
      console.log(
        `  ✅ Budget: ${b.name} (₹${b.allocated.toLocaleString('en-IN')} allocated, ₹${b.spent.toLocaleString('en-IN')} spent)`
      );
    }

    // ── Find some staff users to be requesters ──
    const staffUsers = await db
      .collection('users')
      .find({
        tenantId,
        roleCode: { $in: ['TEACHER', 'HR_MANAGER', 'ACCOUNTANT', 'RECEPTIONIST'] },
      })
      .limit(5)
      .toArray();

    const requesters =
      staffUsers.length > 0
        ? staffUsers.map((u) => ({
            userId: u._id,
            userName: u.profile?.firstName
              ? `${u.profile.firstName} ${u.profile.lastName || ''}`.trim()
              : u.email,
          }))
        : [{ userId: createdBy, userName }];

    const pickRequester = () => requesters[Math.floor(Math.random() * requesters.length)];

    // ── Expenses ──
    console.log('🧾 Creating expenses...');

    const daysAgo = (d: number) => new Date(Date.now() - d * 24 * 60 * 60 * 1000);

    const expenseDefs = [
      // Paid
      {
        title: 'Wifi Router Replacement',
        category: 'equipment',
        amount: 8500,
        status: 'paid',
        budgetCat: 'equipment',
        daysAgo: 45,
        paymentMode: 'bank_transfer',
        paymentRef: 'TXN20260301001',
      },
      {
        title: 'Annual Sports Day Event',
        category: 'events',
        amount: 85000,
        status: 'paid',
        budgetCat: 'events',
        daysAgo: 30,
        paymentMode: 'cheque',
        paymentRef: 'CHQ-4521',
      },
      {
        title: 'Electricity Bill - March 2026',
        category: 'utilities',
        amount: 72000,
        status: 'paid',
        budgetCat: 'utilities',
        daysAgo: 15,
        paymentMode: 'bank_transfer',
        paymentRef: 'TXN20260401002',
      },
      {
        title: 'Lab Chemicals Restocking',
        category: 'supplies',
        amount: 34500,
        status: 'paid',
        budgetCat: 'supplies',
        daysAgo: 25,
        paymentMode: 'bank_transfer',
        paymentRef: 'TXN20260315003',
      },

      // Approved
      {
        title: 'New Projector for Seminar Hall',
        category: 'equipment',
        amount: 45000,
        status: 'approved',
        budgetCat: 'equipment',
        daysAgo: 5,
      },
      {
        title: 'Plumbing Repair - Block B',
        category: 'maintenance',
        amount: 12000,
        status: 'approved',
        budgetCat: 'maintenance',
        daysAgo: 3,
      },
      {
        title: 'Water Purifier AMC Renewal',
        category: 'maintenance',
        amount: 18000,
        status: 'approved',
        budgetCat: 'maintenance',
        daysAgo: 7,
      },

      // Submitted (pending approval)
      {
        title: 'Teacher Workshop Travel - Delhi',
        category: 'travel',
        amount: 28000,
        status: 'submitted',
        budgetCat: 'travel',
        daysAgo: 2,
      },
      {
        title: 'Science Fair Materials',
        category: 'supplies',
        amount: 15000,
        status: 'submitted',
        budgetCat: 'supplies',
        daysAgo: 1,
      },
      {
        title: 'AC Servicing - Admin Block',
        category: 'maintenance',
        amount: 9500,
        status: 'submitted',
        budgetCat: 'maintenance',
        daysAgo: 1,
      },
      {
        title: 'Guest Lecture Honorarium',
        category: 'events',
        amount: 10000,
        status: 'submitted',
        budgetCat: 'events',
        daysAgo: 0,
      },

      // Draft
      {
        title: 'New Whiteboard Markers (Bulk)',
        category: 'supplies',
        amount: 3200,
        status: 'draft',
        budgetCat: 'supplies',
        daysAgo: 0,
      },
      {
        title: 'Parking Lot Repainting',
        category: 'maintenance',
        amount: 35000,
        status: 'draft',
        budgetCat: 'maintenance',
        daysAgo: 0,
      },

      // Rejected
      {
        title: 'Staff Picnic to Goa',
        category: 'travel',
        amount: 120000,
        status: 'rejected',
        budgetCat: 'travel',
        daysAgo: 10,
        rejectReason: 'Budget exceeded for this quarter. Resubmit in Q2.',
      },
      {
        title: 'Premium Coffee Machine for Staff Room',
        category: 'equipment',
        amount: 55000,
        status: 'rejected',
        budgetCat: 'equipment',
        daysAgo: 20,
        rejectReason: 'Not a priority expense. Consider in next fiscal year.',
      },
    ];

    let expenseCount = 0;
    for (const exp of expenseDefs) {
      const seq = await nextSeq('expenseNumber', 6);
      const expenseNumber = `EXP${year}${seq}`;
      const requester = pickRequester();
      const createdAt = daysAgo(exp.daysAgo);

      const approvalChain: Record<string, unknown>[] = [];

      if (['submitted', 'approved', 'paid', 'rejected'].includes(exp.status)) {
        approvalChain.push({
          userId: requester.userId,
          userName: requester.userName,
          action: 'submitted',
          remarks: null,
          timestamp: new Date(createdAt.getTime() + 60 * 60 * 1000), // 1hr after creation
        });
      }

      if (['approved', 'paid'].includes(exp.status)) {
        approvalChain.push({
          userId: createdBy,
          userName,
          action: 'approved',
          remarks: 'Approved. Within budget.',
          timestamp: new Date(createdAt.getTime() + 24 * 60 * 60 * 1000), // 1 day after
        });
      }

      if (exp.status === 'rejected') {
        approvalChain.push({
          userId: createdBy,
          userName,
          action: 'rejected',
          remarks: exp.rejectReason,
          timestamp: new Date(createdAt.getTime() + 24 * 60 * 60 * 1000),
        });
      }

      if (exp.status === 'paid') {
        approvalChain.push({
          userId: createdBy,
          userName,
          action: 'paid',
          remarks: null,
          timestamp: new Date(createdAt.getTime() + 2 * 24 * 60 * 60 * 1000), // 2 days after
        });
      }

      await db.collection('expenses').insertOne({
        tenantId,
        branchId,
        expenseNumber,
        title: exp.title,
        description: null,
        category: exp.category,
        amount: exp.amount,
        currency: 'INR',
        requestedBy: { userId: requester.userId, userName: requester.userName },
        status: exp.status,
        approvalChain,
        budgetId: budgetIds[exp.budgetCat] || null,
        attachments: [],
        paymentMode: exp.paymentMode || null,
        paymentRef: exp.paymentRef || null,
        paidAt:
          exp.status === 'paid' ? new Date(createdAt.getTime() + 2 * 24 * 60 * 60 * 1000) : null,
        createdBy: requester.userId,
        createdAt,
        updatedAt: now,
      });
      expenseCount++;
    }

    console.log(`  ✅ Created ${expenseCount} expenses`);

    console.log('\n🎉 Expense & budget seed complete!');
    console.log(`   📊 ${Object.keys(budgetIds).length} budgets`);
    console.log(
      `   🧾 ${expenseCount} expenses (4 paid, 3 approved, 4 submitted, 2 draft, 2 rejected)`
    );
  } catch (error) {
    console.error('❌ Seed failed:', error);
  } finally {
    await client.close();
  }
}

seedExpenses();
