import { ObjectId } from 'mongodb';
import { collections } from '../../config/database';

export interface ReceiptIssuer {
  /** The college the student pays: their constituent institution, else the organization. */
  name: string;
  logo?: string;
}

/**
 * Who a fee receipt is issued by. In a university that is the student's
 * constituent institution (class → department → institution); a school or a
 * single-institution college falls back to the organization. The logo
 * follows the same order, then the campus's own logo.
 */
export async function resolveReceiptIssuer(
  tenantId: ObjectId,
  branchId: ObjectId,
  studentId: ObjectId
): Promise<ReceiptIssuer> {
  const [tenant, branchSettings, student] = await Promise.all([
    collections.tenants.findOne({ _id: tenantId }, { projection: { name: 1, 'branding.logo': 1 } }),
    collections.branchSettings.findOne({ branchId }, { projection: { 'branding.logo': 1 } }),
    collections.students.findOne(
      { _id: studentId, tenantId },
      { projection: { 'currentEnrollment.classId': 1 } }
    ),
  ]);

  type InstitutionDoc = { name?: string; isDefault?: boolean; settings?: { logo?: string } };
  let institution = null as InstitutionDoc | null;
  const classId = (student?.currentEnrollment as { classId?: ObjectId } | undefined)?.classId;
  if (classId) {
    const classDoc = await collections.classes.findOne(
      { _id: classId },
      { projection: { departmentId: 1 } }
    );
    const department = classDoc?.departmentId
      ? await collections.departments.findOne(
          { _id: classDoc.departmentId as ObjectId },
          { projection: { institutionId: 1 } }
        )
      : null;
    if (department?.institutionId) {
      institution = (await collections.institutions.findOne(
        { _id: department.institutionId as ObjectId, tenantId },
        { projection: { name: 1, isDefault: 1, 'settings.logo': 1 } }
      )) as InstitutionDoc | null;
    }
  }

  // A campus's default institution just mirrors the campus, so the
  // organization's own name reads better there.
  const named = institution && !institution.isDefault ? institution : null;
  const logo =
    named?.settings?.logo ||
    (branchSettings?.branding as { logo?: string } | undefined)?.logo ||
    (tenant?.branding as { logo?: string } | undefined)?.logo ||
    undefined;

  return {
    name: named?.name || String(tenant?.name ?? 'Educational Institution'),
    ...(logo && { logo }),
  };
}
