import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@instagram/shared';

type ErrorExtras = {
  /** Field-level messages for VALIDATION_FAILED */
  fields?: Record<string, string>;
  /** Extra data for the client, e.g. { callId } */
  details?: Record<string, unknown>;
};

/**
 * Every error the API sends to the client goes through this class,
 * so the response always has a translatable `code` (see docs/spec/i18n.md).
 */
export class AppException extends HttpException {
  constructor(
    status: HttpStatus,
    readonly code: ErrorCode,
    message: string,
    extras: ErrorExtras = {},
  ) {
    super({ code, message, ...extras }, status);
  }
}

export const badRequest = (code: ErrorCode, message: string, extras?: ErrorExtras) =>
  new AppException(HttpStatus.BAD_REQUEST, code, message, extras);

export const unauthorized = (
  code: ErrorCode = ErrorCode.UNAUTHORIZED,
  message = 'Please log in to continue.',
) => new AppException(HttpStatus.UNAUTHORIZED, code, message);

export const forbidden = (code: ErrorCode = ErrorCode.FORBIDDEN, message = "You can't do that.") =>
  new AppException(HttpStatus.FORBIDDEN, code, message);

export const notFound = (code: ErrorCode = ErrorCode.NOT_FOUND, message = 'Not found.') =>
  new AppException(HttpStatus.NOT_FOUND, code, message);

export const conflict = (code: ErrorCode, message: string, extras?: ErrorExtras) =>
  new AppException(HttpStatus.CONFLICT, code, message, extras);

export const serviceUnavailable = (message: string) =>
  new AppException(HttpStatus.SERVICE_UNAVAILABLE, ErrorCode.SERVICE_UNAVAILABLE, message);
