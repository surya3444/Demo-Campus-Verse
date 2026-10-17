/* eslint-disable no-undef */
/**
 * Migration: Add type/category fields to existing fee data.
 * Run once after deploying hostel fee integration.
 *
 * Usage:
 *   mongosh <connection-string> migrate-fee-types.js
 */

// Set type='tuition' on all existing fee assignments that don't have a type
const assignmentResult = db.fee_assignments.updateMany(
  { type: { $exists: false } },
  { $set: { type: 'tuition' } }
);
print(`Fee assignments updated: ${assignmentResult.modifiedCount}`);

// Set category='tuition' on all existing fee structures that don't have a category
const structureResult = db.fee_structures.updateMany(
  { category: { $exists: false } },
  { $set: { category: 'tuition' } }
);
print(`Fee structures updated: ${structureResult.modifiedCount}`);

// Create compound index for the new uniqueness check
db.fee_assignments.createIndex(
  { tenantId: 1, studentId: 1, academicBatchId: 1, feeStructureId: 1 },
  { name: 'unique_student_batch_structure' }
);
print('Index created: unique_student_batch_structure');

print('Migration complete.');
