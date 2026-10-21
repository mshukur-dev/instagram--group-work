import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ThrottlerException } from '@nestjs/throttler';
import type { Response } from 'express';
import { type ApiError, ErrorCode } from '@instagram/shared';
import { AppException } from '../errors/app-exception';

const STATUS_CODES: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: ErrorCode.VALIDATION_FAILED,
  [HttpStatus.UNAUTHORIZED]: ErrorCode.UNAUTHORIZED,
  [HttpStatus.FORBIDDEN]: ErrorCode.FORBIDDEN,
  [HttpStatus.NOT_FOUND]: ErrorCode.NOT_FOUND,
  [HttpStatus.CONFLICT]: ErrorCode.CONFLICT,
  [HttpStatus.TOO_MANY_REQUESTS]: ErrorCode.TOO_MANY_REQUESTS,
  [HttpStatus.SERVICE_UNAVAILABLE]: ErrorCode.SERVICE_UNAVAILABLE,
};

/** Converts every thrown error into the ApiError shape: { statusCode, code, message }. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    // Socket.IO errors are handled by the gateway itself
    if (host.getType() !== 'http') return;

    const res = host.switchToHttp().getResponse<Response>();
    const body = this.toApiError(exception);
    if (body.statusCode >= 500) this.logger.error(exception);
    res.status(body.statusCode).json(body);
  }

  private toApiError(exception: unknown): ApiError {
    if (exception instanceof AppException) {
      const res = exception.getResponse() as Pick<ApiError, 'message' | 'details' | 'fields'>;
      return { statusCode: exception.getStatus(), code: exception.code, ...res };
    }

    if (exception instanceof ThrottlerException) {
      return {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        code: ErrorCode.TOO_MANY_REQUESTS,
        message: 'Please wait a few minutes before you try again.',
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      const message =
        typeof res === 'string'
          ? res
          : String((res as { message?: unknown }).message ?? exception.message);
      return { statusCode: status, code: STATUS_CODES[status] ?? ErrorCode.UNKNOWN, message };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // P2002: unique constraint, P2025: record not found
      if (exception.code === 'P2002') {
        return { statusCode: 409, code: ErrorCode.CONFLICT, message: 'This already exists.' };
      }
      if (exception.code === 'P2025') {
        return { statusCode: 404, code: ErrorCode.NOT_FOUND, message: 'Not found.' };
      }
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ErrorCode.UNKNOWN,
      message: 'Something went wrong. Please try again.',
    };
  }
}
