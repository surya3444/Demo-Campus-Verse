import { Response } from 'express';

interface Meta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  hasMore?: boolean;
}

interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: Meta;
  message?: string;
  [key: string]: unknown;
}

export function success<T>(
  res: Response,
  data: T,
  meta?: Meta,
  message?: string,
  extra?: Record<string, unknown>
): Response<ApiResponse<T>> {
  return res.json({
    success: true,
    data,
    ...(meta && { meta }),
    ...(message && { message }),
    ...(extra && extra),
  });
}

export function created<T>(
  res: Response,
  data: T,
  message = 'Created successfully'
): Response<ApiResponse<T>> {
  return res.status(201).json({
    success: true,
    data,
    message,
  });
}

export function noContent(res: Response): Response {
  return res.status(204).send();
}

export function accepted<T>(
  res: Response,
  data: T,
  message = 'Request accepted'
): Response<ApiResponse<T>> {
  return res.status(202).json({
    success: true,
    data,
    message,
  });
}
