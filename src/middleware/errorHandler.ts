import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import logger from '../utils/logger';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error({
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
      code: err.constructor.name,
    });
  }

  res.status(500).json({
    status: 'error',
    message: 'Internal server error',
    code: 'InternalServerError',
  });
};
