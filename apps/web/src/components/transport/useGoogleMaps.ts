'use client';

import { useJsApiLoader, Libraries } from '@react-google-maps/api';
import { useQuery } from '@tanstack/react-query';
import { transportApi } from '@/lib/api';

const LIBRARIES: Libraries = ['places', 'geometry'];

export interface TransportSettings {
  _id?: string;
  googleMapsApiKey: string;
  defaultCurrency: string;
  defaultFrequency: 'monthly' | 'quarterly' | 'yearly';
  autoAssignEnrollmentCode: boolean;
  notifyOnEnrollment: boolean;
}

export function useTransportSettings() {
  return useQuery({
    queryKey: ['transport-settings'],
    queryFn: async () => {
      const res = await transportApi.getSettings();
      return res.data as TransportSettings;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useGoogleMapsLoader(apiKey?: string) {
  const resolvedKey = apiKey || process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY || '';

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'campus-verse-google-maps',
    googleMapsApiKey: resolvedKey,
    libraries: LIBRARIES,
    preventGoogleFontsLoading: true,
  });

  return { isLoaded: isLoaded && !!resolvedKey, loadError, hasApiKey: !!resolvedKey };
}
