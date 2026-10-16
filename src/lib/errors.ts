/**
 * Domain errors. Their messages are safe to show to users; anything else that is
 * thrown is reported as a generic failure so internals never leak.
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string = "APP_ERROR",
    public readonly status: number = 400,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string,
    public readonly fieldErrors: Record<string, string[]> = {},
  ) {
    super(message, "VALIDATION_ERROR", 422);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "The requested item was not found.") {
    super(message, "NOT_FOUND", 404);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action.") {
    super(message, "FORBIDDEN", 403);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Please sign in to continue.") {
    super(message, "UNAUTHORIZED", 401);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, "CONFLICT", 409);
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Too many requests. Please wait a moment and try again.") {
    super(message, "RATE_LIMITED", 429);
  }
}

export class InsufficientStockError extends AppError {
  constructor(
    public readonly sku: string,
    public readonly available: number,
    productName?: string,
  ) {
    super(
      available > 0
        ? `Only ${available} unit${available === 1 ? "" : "s"} of ${productName ?? sku} ${available === 1 ? "is" : "are"} available.`
        : `${productName ?? sku} is out of stock.`,
      "INSUFFICIENT_STOCK",
      409,
    );
  }
}

export class PriceChangedError extends AppError {
  constructor(public readonly newTotalMinor: number) {
    super("Prices or availability changed since you loaded this page. Please review your order total.", "PRICE_CHANGED", 409);
  }
}

export class InvalidTransitionError extends AppError {
  constructor(from: string, to: string) {
    super(`An order cannot move from ${from} to ${to}.`, "INVALID_TRANSITION", 409);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/** Prisma unique-constraint violation helper (P2002). */
export function isUniqueViolation(error: unknown, field?: string): boolean {
  if (typeof error !== "object" || error === null) return false;
  const e = error as { code?: string; meta?: { target?: string[] | string } };
  if (e.code !== "P2002") return false;
  if (!field) return true;
  const target = e.meta?.target;
  return Array.isArray(target) ? target.includes(field) : typeof target === "string" ? target.includes(field) : false;
}
