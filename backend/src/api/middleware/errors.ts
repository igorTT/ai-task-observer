import type { ErrorRequestHandler, RequestHandler } from "express";
import { ValidateError } from "tsoa";

interface HttpError extends Error {
  status?: number;
}

export const notFoundHandler: RequestHandler = (request, response) => {
  response.status(404).json({
    error: {
      code: "not_found",
      message: `No route matches ${request.method} ${request.path}`,
    },
  });
};

export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  if (error instanceof ValidateError) {
    response.status(422).json({
      error: {
        code: "validation_error",
        message: "Request validation failed",
        details: error.fields,
      },
    });
    return;
  }

  const httpError = error as HttpError;
  const status = typeof httpError.status === "number" ? httpError.status : 500;
  response.status(status).json({
    error: {
      code: status >= 500 ? "internal_error" : "request_error",
      message: status >= 500 ? "An unexpected error occurred" : httpError.message,
    },
  });
};
