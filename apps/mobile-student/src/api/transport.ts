import { apiClient, fetchApi } from '@campus-verse/mobile-shared/api/client';

export interface TransportEnrollment {
  _id: string;
  busId: string;
  busNumber?: string;
  busName?: string;
  stopId: string;
  stopName?: string;
  pickupTime?: string;
  dropTime?: string;
  pickupEnabled: boolean;
  dropEnabled: boolean;
  priceSnapshot: number;
  pricingModeSnapshot: 'flat' | 'per_stop';
  frequencySnapshot: 'monthly' | 'quarterly' | 'yearly';
  currencySnapshot: string;
  startDate: string;
  status: 'active' | 'withdrawn' | 'transferred';
}

export interface TransportBusDetail {
  _id: string;
  busNumber: string;
  name: string;
  type: string;
  capacity: number;
  driverName?: string;
  driverPhone?: string;
  conductorName?: string;
  conductorPhone?: string;
  vehicleRegistration?: string;
  startLocation?: { name: string; address?: string };
  stops: Array<{
    _id: string;
    name: string;
    address?: string;
    sequence: number;
    pickupTime?: string;
    dropTime?: string;
    fare?: number;
  }>;
  pricing: {
    mode: 'flat' | 'per_stop';
    flatPrice?: number;
    frequency: string;
    currency: string;
  };
  totalDistanceMeters?: number;
  totalDurationSeconds?: number;
}

export interface MyTransportResponse {
  enrollment: TransportEnrollment;
  bus: TransportBusDetail | null;
}

export const transportApi = {
  getMyEnrollment: async (): Promise<MyTransportResponse | null> => {
    try {
      return await fetchApi<MyTransportResponse | null>(apiClient.get('/transport/enrollments/my'));
    } catch {
      return null;
    }
  },
};
