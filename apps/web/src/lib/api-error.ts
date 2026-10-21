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
