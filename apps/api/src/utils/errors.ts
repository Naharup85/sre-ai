export class ApiError extends Error {
  public statusCode: number;
  public success: boolean;
  public errors?: any;

  constructor(message: string, statusCode: number, errors?: any) {
    super(message);
    this.success = false;
    this.statusCode = statusCode;
    this.errors = errors;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  public static notFound(message: string = "Resource not found") {
    return new ApiError(message, 404);
  }

  public static badRequest(message: string = "Bad Request", errors?: any) {
    return new ApiError(message, 400, errors);
  }

  public static unprocessableEntity(message: string = "Unprocessable Entity") {
    return new ApiError(message, 422);
  }

  public static internalServerError(message: string = "Internal Server Error") {
    return new ApiError(message, 500);
  }

  public static forbidden(message: string = "Forbidden") {
    return new ApiError(message, 403);
  }

  public static unAuthorized(message: string = "Unauthorized") {
    return new ApiError(message, 401);
  }

  public static conflict(message: string = "Conflict") {
    return new ApiError(message, 409);
  }
}


export default ApiError;

