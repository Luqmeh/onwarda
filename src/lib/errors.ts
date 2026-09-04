export class AppError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
  }
}

export class AuthenticationError extends AppError {
  constructor(message = "Authentication required.") {
    super("unauthenticated", message, 401);
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends AppError {
  constructor(message = "You do not have permission to access this resource.") {
    super("forbidden", message, 403);
    this.name = "AuthorizationError";
  }
}

export class TenantIsolationError extends AppError {
  constructor(message = "Organization access denied.") {
    super("tenant_isolation", message, 403);
    this.name = "TenantIsolationError";
  }
}

export class ValidationError extends AppError {
  constructor(message = "The submitted data is invalid.") {
    super("validation_error", message, 400);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "The requested resource was not found.") {
    super("not_found", message, 404);
    this.name = "NotFoundError";
  }
}

export function toPublicErrorMessage(error: unknown) {
  if (error instanceof AppError) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}
