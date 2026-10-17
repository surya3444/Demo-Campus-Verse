import { describe, it, expect } from 'vitest';
import { getPagination, buildPaginationMeta } from '../../utils/pagination';

describe('getPagination', () => {
  it('returns defaults when no query params provided', () => {
    const result = getPagination({});
    expect(result).toEqual({
      page: 1,
      limit: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
  });

  it('parses valid page and limit', () => {
    const result = getPagination({ page: '3', limit: '50' });
    expect(result.page).toBe(3);
    expect(result.limit).toBe(50);
  });

  it('clamps page to minimum of 1', () => {
    const result = getPagination({ page: '-5' });
    expect(result.page).toBe(1);
  });

  it('clamps page to 1 for zero', () => {
    const result = getPagination({ page: '0' });
    expect(result.page).toBe(1);
  });

  it('clamps limit to maximum of 100', () => {
    const result = getPagination({ limit: '500' });
    expect(result.limit).toBe(100);
  });

  it('clamps limit to minimum of 1', () => {
    const result = getPagination({ limit: '-10' });
    expect(result.limit).toBe(1);
  });

  it('handles non-numeric strings gracefully', () => {
    const result = getPagination({ page: 'abc', limit: 'xyz' });
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it('respects custom sortBy', () => {
    const result = getPagination({ sortBy: 'name' });
    expect(result.sortBy).toBe('name');
  });

  it('parses sortOrder asc', () => {
    const result = getPagination({ sortOrder: 'asc' });
    expect(result.sortOrder).toBe('asc');
  });

  it('defaults sortOrder to desc for invalid values', () => {
    const result = getPagination({ sortOrder: 'invalid' });
    expect(result.sortOrder).toBe('desc');
  });
});

describe('buildPaginationMeta', () => {
  it('builds correct meta for first page', () => {
    const meta = buildPaginationMeta(1, 10, 50);
    expect(meta).toEqual({
      page: 1,
      limit: 10,
      total: 50,
      totalPages: 5,
      hasMore: true,
    });
  });

  it('builds correct meta for last page', () => {
    const meta = buildPaginationMeta(5, 10, 50);
    expect(meta).toEqual({
      page: 5,
      limit: 10,
      total: 50,
      totalPages: 5,
      hasMore: false,
    });
  });

  it('handles zero total', () => {
    const meta = buildPaginationMeta(1, 20, 0);
    expect(meta.totalPages).toBe(0);
    expect(meta.hasMore).toBe(false);
  });

  it('handles partial last page correctly', () => {
    const meta = buildPaginationMeta(1, 20, 25);
    expect(meta.totalPages).toBe(2);
    expect(meta.hasMore).toBe(true);
  });

  it('single page results', () => {
    const meta = buildPaginationMeta(1, 20, 10);
    expect(meta.totalPages).toBe(1);
    expect(meta.hasMore).toBe(false);
  });

  it('exact page boundary', () => {
    const meta = buildPaginationMeta(2, 10, 20);
    expect(meta.totalPages).toBe(2);
    expect(meta.hasMore).toBe(false);
  });
});
