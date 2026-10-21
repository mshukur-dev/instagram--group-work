import type { PipeTransform } from '@nestjs/common';
import type { z } from 'zod';
import { ErrorCode } from '@instagram/shared';
import { badRequest } from '../errors/app-exception';

/**
 * Validates and transforms a request part with a zod schema from @instagram/shared.
 * Usage: @Body(new ZodValidationPipe(registerSchema)) dto: RegisterInput
 */
export class ZodValidationPipe<T extends z.ZodType> implements PipeTransform {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.output<T> {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;

    const fields: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || '_';
      fields[key] ??= issue.message;
    }
    const first = result.error.issues[0];
    const message = first ? `${first.path.join('.') || 'body'}: ${first.message}` : 'Invalid request.';
    throw badRequest(ErrorCode.VALIDATION_FAILED, message, { fields });
  }
}
