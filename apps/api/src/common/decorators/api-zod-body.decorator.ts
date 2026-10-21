import { applyDecorators } from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';
import { z } from 'zod';

/**
 * Shows a zod schema as the request body in Swagger.
 * Validation itself is done by ZodValidationPipe on the @Body parameter.
 */
export const ApiZodBody = (schema: z.ZodType) =>
  applyDecorators(
    ApiBody({
      schema: z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as Record<
        string,
        unknown
      >,
    }),
  );
