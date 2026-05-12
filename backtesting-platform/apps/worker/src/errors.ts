export class HttpError extends Error {
  constructor(readonly status: number, message: string, readonly details?: unknown) {
    super(message);
    this.name = new.target.name;
  }
}

export class BadRequestError extends HttpError {
  constructor(message = "bad request", details?: unknown) {
    super(400, message, details);
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = "unauthorized") {
    super(401, message);
  }
}

export class NotFoundError extends HttpError {
  constructor(message = "not found") {
    super(404, message);
  }
}

export class TooManyRequestsError extends HttpError {
  constructor(readonly retryAfterSec: number, message = "rate limit exceeded") {
    super(429, message);
  }
}
