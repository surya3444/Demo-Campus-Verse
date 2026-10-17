import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';

export class ApiError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number = 500,
    public details?: unknown[]
  ) {
    super(message);
    this.name = 'ApiError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorHandler(error: Error, req: Request, res: Response, _next: NextFunction): void {
  logger.error({
    err: error,
    req: {
      method: req.method,
      url: req.url,
      body: req.body,
      query: req.query,
      params: req.params,
    },
  });

  if (error instanceof ApiError) {
    res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.details && { details: error.details }),
      },
    });
    return;
  }

  // MongoDB duplicate key error
  if ((error as unknown as Record<string, unknown>).code === 11000) {
    res.status(409).json({
      success: false,
      error: {
        code: 'DUPLICATE_ENTRY',
        message: 'A record with this value already exists',
      },
    });
    return;
  }

  // Zod validation error
  if (error.name === 'ZodError') {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: (error as unknown as Record<string, unknown>).errors,
      },
    });
    return;
  }

  // Default error
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message:
        process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : error.message,
    },
  });
}
