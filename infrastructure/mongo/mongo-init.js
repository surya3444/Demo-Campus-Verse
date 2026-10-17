// MongoDB initialization script
// This runs when the container is first created

print('Starting MongoDB initialization...');

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

print('Collections created successfully');

// Create indexes
db.tenants.createIndex({ code: 1 }, { unique: true });
db.branches.createIndex({ tenantId: 1, code: 1 }, { unique: true });
db.users.createIndex({ tenantId: 1, email: 1 }, { unique: true });
db.roles.createIndex({ tenantId: 1, code: 1 }, { unique: true });
db.students.createIndex({ tenantId: 1, branchId: 1, admissionNumber: 1 }, { unique: true });
db.students.createIndex({ firstName: 'text', lastName: 'text', admissionNumber: 'text' });
db.fee_transactions.createIndex({ tenantId: 1, branchId: 1, receiptNumber: 1 }, { unique: true });

print('Indexes created successfully');
print('MongoDB initialization completed!');
