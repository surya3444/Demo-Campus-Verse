import { BaseEntity, Status } from './common';

export type BusType = 'mini' | 'standard' | 'luxury' | 'van';
export type PricingMode = 'flat' | 'per_stop';
export type TransportEnrollmentStatus = 'active' | 'withdrawn' | 'transferred';

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface RouteLocation {
  name: string;
  address?: string;
  placeId?: string;
  location: GeoPoint;
}

export interface RouteStop {
  _id: string;
  name: string;
  address?: string;
  placeId?: string;
  location: GeoPoint;
  sequence: number;
  pickupTime?: string;
  dropTime?: string;
  fare?: number;
  enrolledStudents: number;
}

export interface BusPricing {
  mode: PricingMode;
  flatPrice?: number;
  currency: string;
  frequency: 'monthly' | 'quarterly' | 'yearly';
}

export interface Bus extends BaseEntity {
  branchId: string;
  busNumber: string;
  name: string;
  type: BusType;
  capacity: number;
  driverName?: string;
  driverPhone?: string;
  conductorName?: string;
  conductorPhone?: string;
  vehicleRegistration?: string;
  startLocation: RouteLocation;
  stops: RouteStop[];
  routePolyline?: string;
  totalDistanceMeters?: number;
  totalDurationSeconds?: number;
  pricing: BusPricing;
  enrolledCount: number;
  status: Status;
  notes?: string;
}

export interface TransportEnrollment extends BaseEntity {
  branchId: string;
  busId: string;
  busNumber?: string;
  stopId: string;
  stopName?: string;
  studentId: string;
  studentName?: string;
  admissionNumber?: string;
  classId?: string;
  className?: string;
  sectionId?: string;
  sectionName?: string;
  pickupEnabled: boolean;
  dropEnabled: boolean;
  startDate: Date;
  endDate?: Date;
  priceSnapshot: number;
  frequencySnapshot: BusPricing['frequency'];
  pricingModeSnapshot: PricingMode;
  status: TransportEnrollmentStatus;
  withdrawnAt?: Date;
  withdrawnReason?: string;
}

export interface TransportSettings {
  _id?: string;
  tenantId: string;
  branchId: string;
  googleMapsApiKey?: string;
  defaultCurrency: string;
  defaultFrequency: BusPricing['frequency'];
  autoAssignEnrollmentCode: boolean;
  notifyOnEnrollment: boolean;
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TransportStats {
  totalBuses: number;
  activeBuses: number;
  totalCapacity: number;
  totalEnrolled: number;
  availableSeats: number;
  occupancyRate: number;
  totalStops: number;
}
