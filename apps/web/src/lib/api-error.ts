import { isAxiosError } from 'axios';
import { ErrorCode, type ApiError } from '@instagram/shared';

/** Error code from an API response; UNKNOWN for network failures and anything unexpected. */
export function getErrorCode(error: unknown): ErrorCode {
  if (isAxiosError<Partial<ApiError>>(error)) {
    const code = error.response?.data?.code;
    if (code && Object.values(ErrorCode).includes(code)) return code;
  }
  return ErrorCode.UNKNOWN;
}

/** Extra data of an API error, e.g. { callId } for CALL_ALREADY_ACTIVE. */
export function getErrorDetails(error: unknown): Record<string, unknown> {
  if (isAxiosError<Partial<ApiError>>(error)) return error.response?.data?.details ?? {};
  return {};
}
