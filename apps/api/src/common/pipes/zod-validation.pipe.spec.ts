import { ErrorCode, registerSchema } from '@instagram/shared';
import { AppException } from '../errors/app-exception';
import { ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(registerSchema);
  const valid = {
    email: 'Ivan@Example.com',
    fullName: 'Ivan Petrov',
    username: 'Ivan.Petrov',
    password: 'password123',
  };

  it('returns transformed data for valid input', () => {
    expect(pipe.transform(valid)).toEqual({
      ...valid,
      email: 'ivan@example.com',
      username: 'ivan.petrov',
    });
  });

  it('throws VALIDATION_FAILED with field errors', () => {
    try {
      pipe.transform({ ...valid, username: 'a', password: 'short' });
      fail('expected to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(AppException);
      const ex = error as AppException;
      expect(ex.getStatus()).toBe(400);
      expect(ex.code).toBe(ErrorCode.VALIDATION_FAILED);
      const body = ex.getResponse() as { fields: Record<string, string> };
      expect(Object.keys(body.fields)).toEqual(expect.arrayContaining(['username', 'password']));
    }
  });

  it('rejects usernames with consecutive periods', () => {
    expect(() => pipe.transform({ ...valid, username: 'ivan..p' })).toThrow(AppException);
  });
});
