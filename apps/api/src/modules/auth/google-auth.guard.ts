import { type ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import { AppConfigService } from '../../config/app-config.service';

/**
 * Runs the Google OAuth flow. If Google keys are not configured or the user
 * cancels on Google's page, redirects back to the login page with an error flag
 * instead of returning JSON (the user is in a browser redirect, not in fetch).
 */
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  constructor(private readonly config: AppConfigService) {
    super();
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.config.isGoogleEnabled) {
      this.redirectToLogin(context, 'google_not_configured');
      return false;
    }
    try {
      return (await super.canActivate(context)) as boolean;
    } catch {
      this.redirectToLogin(context, 'google_failed');
      return false;
    }
  }

  private redirectToLogin(context: ExecutionContext, error: string): void {
    const res = context.switchToHttp().getResponse<Response>();
    res.redirect(`${this.config.get('WEB_URL')}/accounts/login?error=${error}`);
  }
}
