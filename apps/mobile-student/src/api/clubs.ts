import { apiClient, fetchApi } from '@campus-verse/mobile-shared/api/client';

export interface Club {
  _id: string;
  name: string;
  category: string;
  tagline?: string;
  description?: string;
  emoji?: string;
  icon?: string;
  theme?: string;
  institutionName?: string | null;
  coordinator?: { name?: string; photo?: string };
  meeting?: { day?: string; time?: string; venue?: string };
  tags?: string[];
  highlights?: string[];
  memberCount: number;
  isMember?: boolean;
  faces?: Array<{ photo?: string; name?: string }>;
}

export const clubsApi = {
  list: (params?: { search?: string; category?: string; mine?: boolean }) =>
    fetchApi<Club[]>(apiClient.get('/clubs', { params: { ...params, mine: params?.mine ? 'true' : undefined } })),
  get: (id: string) => fetchApi<Club>(apiClient.get(`/clubs/${id}`)),
  join: (id: string) => fetchApi<Club>(apiClient.post(`/clubs/${id}/join`)),
  leave: (id: string) => fetchApi<Club>(apiClient.delete(`/clubs/${id}/join`)),
};
