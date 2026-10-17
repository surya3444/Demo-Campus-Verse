import { BaseEntity, Status } from './common';

// ============ Literal Types ============

export type HostelType = 'boys' | 'girls' | 'co-ed';
export type RoomType = 'single' | 'double' | 'triple' | 'quad' | 'dormitory';
export type RoomStatus =
  | 'available'
  | 'partially_occupied'
  | 'occupied'
  | 'maintenance'
  | 'reserved';
export type BedStatus = 'available' | 'occupied' | 'maintenance' | 'reserved';
export type AllocationStatus = 'active' | 'vacated' | 'transferred' | 'cancelled';

// ============ Hostel ============

export interface Hostel extends BaseEntity {
  branchId: string;
  name: string;
  code: string;
  type: HostelType;
  totalFloors: number;
  floors: string[];
  totalRooms: number;
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  wardenId?: string;
  wardenName?: string;
  amenities: string[];
  status: Status;
  contactNumber?: string;
  email?: string;
}

// ============ Room ============

export interface RoomBed {
  bedNumber: string;
  status: BedStatus;
  studentId?: string;
  allocationId?: string;
}

export interface Room extends BaseEntity {
  branchId: string;
  hostelId: string;
  hostelName?: string;
  roomNumber: string;
  floor: string;
  type: RoomType;
  capacity: number;
  beds: RoomBed[];
  occupiedBeds: number;
  availableBeds: number;
  amenities: string[];
  monthlyRent?: number;
  securityDeposit?: number;
  roomStatus: RoomStatus;
}

// ============ Bed Allocation ============

export interface BedAllocation extends BaseEntity {
  branchId: string;
  hostelId: string;
  hostelName?: string;
  roomId: string;
  roomNumber?: string;
  bedNumber: string;
  studentId: string;
  studentName: string;
  admissionNumber?: string;
  classId?: string;
  className?: string;
  sectionId?: string;
  sectionName?: string;
  academicBatchId?: string;
  allocationDate: Date;
  expectedVacatingDate?: Date;
  actualVacatingDate?: Date;
  previousAllocationId?: string;
  status: AllocationStatus;
  vacatingReason?: string;
}

// ============ Hostel Settings ============

export interface HostelSettings {
  _id?: string;
  tenantId: string;
  branchId: string;
  visitingHours?: {
    start: string;
    end: string;
    days: number[];
  };
  messTimings?: {
    breakfast?: { start: string; end: string };
    lunch?: { start: string; end: string };
    snacks?: { start: string; end: string };
    dinner?: { start: string; end: string };
  };
  hostelRules: string[];
  notifications?: {
    allocationConfirmation: boolean;
    vacatingReminder: boolean;
    reminderDaysBefore: number;
  };
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// ============ Stats & Reports ============

export interface HostelStats {
  totalHostels: number;
  totalRooms: number;
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  occupancyRate: number;
  byType: {
    type: HostelType;
    count: number;
    beds: number;
    occupied: number;
  }[];
}

export interface HostelOccupancyReport {
  hostelId: string;
  hostelName: string;
  type: HostelType;
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  occupancyRate: number;
  floors: {
    floor: string;
    totalRooms: number;
    totalBeds: number;
    occupiedBeds: number;
    availableBeds: number;
  }[];
}

export interface ClassWiseHostelReport {
  classId: string;
  className: string;
  totalStudents: number;
  hostelStudents: number;
  percentage: number;
}
