import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ApiError } from './errorHandler';
import { tagMiddleware } from './meta';

export function validate(schema: ZodSchema) {
  return tagMiddleware({ all: schema }, (req: Request, _res: Response, next: NextFunction): void => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.map((err) => ({
          field: err.path.slice(1).join('.'),
          message: err.message,
        }));

        throw new ApiError('VALIDATION_ERROR', 'Validation failed', 400, details);
      }
      next(error);
    }
  });
}

export function validateBody(schema: ZodSchema) {
  return tagMiddleware({ body: schema }, (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        throw new ApiError('VALIDATION_ERROR', 'Validation failed', 400, details);
      }
      next(error);
    }
  });
}

export function validateQuery(schema: ZodSchema) {
  return tagMiddleware({ query: schema }, (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        throw new ApiError('VALIDATION_ERROR', 'Invalid query parameters', 400, details);
      }
      next(error);
    }
  });
}

export function validateParams(schema: ZodSchema) {
  return tagMiddleware({ params: schema }, (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.params = schema.parse(req.params) as typeof req.params;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        throw new ApiError('VALIDATION_ERROR', 'Invalid path parameters', 400, details);
      }
      next(error);
    }
  });
}
