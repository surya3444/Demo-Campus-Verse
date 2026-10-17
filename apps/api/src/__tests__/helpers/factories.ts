import { ObjectId } from 'mongodb';

export function createMockLead(overrides: Record<string, unknown> = {}) {
  const id = new ObjectId();
  return {
    _id: id,
    tenantId: new ObjectId(),
    branchId: new ObjectId(),
    leadNumber: 'LD2500001',
    firstName: 'Rahul',
    lastName: 'Sharma',
    contact: {
      phone: '+919876543210',
      email: 'parent@example.com',
    },
    parents: {
      father: { name: 'Suresh Sharma', phone: '+919876543210' },
      mother: { name: 'Sunita Sharma' },
    },
    interestedIn: {
      classId: new ObjectId(),
      sectionId: new ObjectId(),
    },
    source: 'walk-in',
    stage: 'new',
    priority: 'medium',
    assignedTo: new ObjectId(),
    followups: [],
    notes: [],
    tags: [],
    status: 'active',
    createdBy: new ObjectId(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createMockStudent(overrides: Record<string, unknown> = {}) {
  const id = new ObjectId();
  return {
    _id: id,
    tenantId: new ObjectId(),
    branchId: new ObjectId(),
    admissionNumber: 'MAIN-2025-0001',
    firstName: 'Amit',
    lastName: 'Kumar',
    dateOfBirth: new Date('2010-05-15'),
    gender: 'male',
    bloodGroup: 'O+',
    category: 'general',
    religion: 'Hindu',
    nationality: 'Indian',
    contact: {
      phone: '+919876543210',
      email: 'student@example.com',
      address: {
        street: '123 MG Road',
        city: 'Pune',
        state: 'Maharashtra',
        pincode: '411001',
      },
    },
    parents: {
      father: { name: 'Rajesh Kumar', phone: '+919876543210', occupation: 'Engineer' },
      mother: { name: 'Priya Kumar', phone: '+919876543211', occupation: 'Teacher' },
    },
    currentEnrollment: {
      academicBatchId: new ObjectId(),
      classId: new ObjectId(),
      sectionId: new ObjectId(),
      rollNumber: 15,
    },
    status: 'active',
    createdBy: new ObjectId(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createMockApplication(overrides: Record<string, unknown> = {}) {
  const id = new ObjectId();
  return {
    _id: id,
    tenantId: new ObjectId(),
    branchId: new ObjectId(),
    applicationNumber: 'APP2500001',
    leadId: new ObjectId(),
    academicBatchId: new ObjectId(),
    classId: new ObjectId(),
    sectionId: new ObjectId(),
    studentInfo: {
      firstName: 'Rahul',
      lastName: 'Sharma',
      dateOfBirth: new Date('2010-05-15'),
      gender: 'male',
    },
    parentInfo: {
      father: { name: 'Suresh Sharma', phone: '+919876543210' },
    },
    stage: 'applied',
    status: 'active',
    createdBy: new ObjectId(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createMockFeeTransaction(overrides: Record<string, unknown> = {}) {
  const id = new ObjectId();
  return {
    _id: id,
    tenantId: new ObjectId(),
    branchId: new ObjectId(),
    receiptNo: 'RCP25000001',
    studentId: new ObjectId(),
    assignmentId: new ObjectId(),
    amount: 5000,
    paymentMode: 'cash',
    components: [
      { name: 'Tuition Fee', amount: 3000 },
      { name: 'Lab Fee', amount: 2000 },
    ],
    status: 'completed',
    collectedBy: new ObjectId(),
    transactionDate: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createMockUser(overrides: Record<string, unknown> = {}) {
  const id = new ObjectId();
  return {
    _id: id,
    tenantId: new ObjectId(),
    email: 'user@test.edu',
    firstName: 'Test',
    lastName: 'User',
    role: 'BRANCH_ADMIN',
    hashedPassword: '$2b$10$fakehash',
    refreshTokens: [],
    accessScope: {
      type: 'branch',
      branchIds: [new ObjectId()],
    },
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}
