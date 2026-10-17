/* eslint-disable no-undef */
// MongoDB initialization script
// This runs when the container is first created

print('Starting MongoDB initialization...');

// docker-compose runs mongod with --replSet rs0, and every write fails with
// "not primary" until the set is initiated — so initiate it before writing.
try {
  rs.status();
} catch (_e) {
  rs.initiate({ _id: 'rs0', members: [{ _id: 0, host: 'localhost:27017' }] });
}
while (!db.hello().isWritablePrimary) sleep(200);

// Switch to the campus_verse database
db = db.getSiblingDB('campus_verse');

// Create collections with validation
db.createCollection('tenants');
db.createCollection('branches');
db.createCollection('users');
db.createCollection('roles');
db.createCollection('academic_batches');
db.createCollection('classes');
db.createCollection('sections');
db.createCollection('subjects');
db.createCollection('students');
db.createCollection('student_enrollments');
db.createCollection('leads');
db.createCollection('applications');
db.createCollection('fee_structures');
db.createCollection('fee_assignments');
db.createCollection('fee_transactions');
db.createCollection('concessions');
db.createCollection('student_attendance');
db.createCollection('staff');
db.createCollection('staff_attendance');
db.createCollection('leaves');
db.createCollection('leave_balances');
db.createCollection('announcements');
db.createCollection('events');
db.createCollection('sms_logs');
db.createCollection('audit_logs');
db.createCollection('settings');
db.createCollection('counters');
db.createCollection('wallets');
db.createCollection('wallet_transactions');
db.createCollection('approval_requests');

print('Collections created successfully');

// Create indexes
db.tenants.createIndex({ code: 1 }, { unique: true });
db.branches.createIndex({ tenantId: 1, code: 1 }, { unique: true });
db.users.createIndex({ tenantId: 1, email: 1 }, { unique: true });
db.roles.createIndex({ tenantId: 1, code: 1 }, { unique: true });
db.students.createIndex({ tenantId: 1, branchId: 1, admissionNumber: 1 }, { unique: true });
db.students.createIndex({ firstName: 'text', lastName: 'text', admissionNumber: 'text' });
db.fee_transactions.createIndex({ tenantId: 1, branchId: 1, receiptNumber: 1 }, { unique: true });

// Wallet indexes
db.wallets.createIndex({ tenantId: 1, studentId: 1 }, { unique: true });
db.wallets.createIndex({ tenantId: 1, branchId: 1, walletNumber: 1 }, { unique: true });
db.wallets.createIndex({ tenantId: 1, branchId: 1 });

// Wallet transaction indexes
db.wallet_transactions.createIndex({ walletId: 1, createdAt: -1 });
db.wallet_transactions.createIndex({ tenantId: 1, branchId: 1, createdAt: -1 });

// Approval request indexes
db.approval_requests.createIndex({ tenantId: 1, branchId: 1, status: 1 });
db.approval_requests.createIndex({ transactionId: 1, status: 1 });
db.approval_requests.createIndex({ tenantId: 1, branchId: 1, createdAt: -1 });

// Teaching module collections
db.createCollection('timetable_slots');
db.createCollection('timetable_entries');
db.createCollection('lesson_plans');
db.createCollection('assignments');
db.createCollection('grades');

// Teaching module indexes
db.timetable_slots.createIndex({ tenantId: 1, branchId: 1, order: 1 });
db.timetable_entries.createIndex(
  { tenantId: 1, branchId: 1, teacherId: 1, slotId: 1, dayOfWeek: 1 },
  { unique: true }
);
db.timetable_entries.createIndex(
  { tenantId: 1, branchId: 1, sectionId: 1, slotId: 1, dayOfWeek: 1 },
  { unique: true }
);
db.lesson_plans.createIndex({ tenantId: 1, branchId: 1, teacherId: 1, date: -1 });
db.lesson_plans.createIndex({ tenantId: 1, sectionId: 1, subjectId: 1 });
db.assignments.createIndex({ tenantId: 1, branchId: 1, teacherId: 1, status: 1 });
db.assignments.createIndex({ tenantId: 1, sectionId: 1, dueDate: -1 });
db.grades.createIndex({ tenantId: 1, assignmentId: 1, studentId: 1 }, { unique: true });
db.grades.createIndex({ tenantId: 1, studentId: 1 });

print('Indexes created successfully');
print('MongoDB initialization completed!');
