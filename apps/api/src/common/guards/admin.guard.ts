import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { notFound } from '../errors/app-exception';
import type { AuthUser } from '../types';

/**
 * ADMIN-1: lets only role = ADMIN through. Runs after the global JwtAuthGuard,
 * so req.user is set and its role comes fresh from the database.
 * Everyone else gets 404, as if /admin did not exist.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest<Request & { user?: AuthUser }>().user;
    if (user?.role !== 'ADMIN') throw notFound();
    return true;
  }
}
