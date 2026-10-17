import { BaseEntity } from './common';

export interface Visitor extends BaseEntity {
  branchId: string;
  visitorCode: string;

  // Identity
  name: string;
  phone: string;
  email?: string;
  company?: string;
  photoUrl?: string;
  idType?: 'aadhar' | 'pan' | 'driving_license' | 'passport' | 'other';
  idNumber?: string;

  // Visit details
  purpose: string;
  hostName: string;
  hostDepartment?: string;
  hostUserId?: string;
  numberOfVisitors: number;
  vehicleNumber?: string;
  belongings?: string;

  // Scheduling
  type: 'walk_in' | 'pre_registered';
  expectedDate?: Date;
  expectedTime?: string;

  // Check-in / Check-out
  status: 'pre_registered' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show';
  checkInTime?: Date;
  checkOutTime?: Date;
  checkedInBy?: string;
  checkedOutBy?: string;

  // Pass
  passCode?: string;
  passIssuedAt?: Date;
  passExpiresAt?: Date;

  remarks?: string;
}

export interface VisitorPass extends BaseEntity {
  branchId: string;
  visitorId: string;
  passCode: string;
  issuedAt: Date;
  expiresAt: Date;
  isActive: boolean;
  revokedAt?: Date;
  revokedBy?: string;
}

export interface VisitorSettings extends BaseEntity {
  branchId: string;
  autoGeneratePassCode: boolean;
  passCodePrefix: string;
  passValidityHours: number;
  requirePhotoForCheckIn: boolean;
  requireIdForCheckIn: boolean;
  allowPreRegistration: boolean;
  customPurposes: string[];
}
