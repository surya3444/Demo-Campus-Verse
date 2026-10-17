export interface PaginationParams {
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const DEFAULT_SORT_BY = 'createdAt';
const DEFAULT_SORT_ORDER = 'desc';

export function getPagination(query: Record<string, unknown>): PaginationParams {
  const page = Math.max(1, parseInt(String(query.page)) || DEFAULT_PAGE);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(String(query.limit)) || DEFAULT_LIMIT));
  const sortBy = String(query.sortBy || DEFAULT_SORT_BY);
  const sortOrder = (query.sortOrder === 'asc' ? 'asc' : DEFAULT_SORT_ORDER) as 'asc' | 'desc';

  return { page, limit, sortBy, sortOrder };
}

export function buildPaginationMeta(
  page: number,
  limit: number,
  total: number
): PaginatedResult<never>['meta'] {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasMore: page < totalPages,
  };
}
