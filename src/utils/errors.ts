export class AppError extends Error {
  constructor(public statusCode: number, public message: string) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(401, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Not found') {
    super(404, message);
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = 'Internal server error') {
    super(500, message);
  }
}
