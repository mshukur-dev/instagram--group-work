import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import {
  type LoginInput,
  loginSchema,
  type Me,
  type RegisterInput,
  registerSchema,
} from '@instagram/shared';
import { ApiZodBody } from '../../common/decorators/api-zod-body.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthUser } from '../../common/types';
import { AppConfigService } from '../../config/app-config.service';
import { clearAuthCookies, REFRESH_COOKIE, setAuthCookies } from './auth.cookies';
import { AuthService, type ClientInfo } from './auth.service';
import { GoogleAuthGuard } from './google-auth.guard';
import type { GoogleProfile } from './strategies/google.strategy';

const AUTH_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: AppConfigService,
  ) {}

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('register')
  @ApiZodBody(registerSchema)
  async register(
    @Body(new ZodValidationPipe(registerSchema)) dto: RegisterInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Me> {
    const { me, tokens } = await this.authService.register(dto, clientInfo(req));
    setAuthCookies(res, tokens, this.config.isProduction);
    return me;
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('login')
  @HttpCode(200)
  @ApiZodBody(loginSchema)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) dto: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Me> {
    const { me, tokens } = await this.authService.login(dto, clientInfo(req));
    setAuthCookies(res, tokens, this.config.isProduction);
    return me;
  }

  @Public()
  @Post('refresh')
  @HttpCode(204)
  @ApiOperation({ summary: 'Rotate tokens using the refresh_token cookie' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    try {
      const tokens = await this.authService.refresh(refreshCookie(req), clientInfo(req));
      setAuthCookies(res, tokens, this.config.isProduction);
    } catch (error) {
      // Dead session: drop logged_in too, so the proxy sends the user to the login page
      clearAuthCookies(res, this.config.isProduction);
      throw error;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.authService.logout(refreshCookie(req));
    clearAuthCookies(res, this.config.isProduction);
  }

  @Public()
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Redirects to Google sign-in (open in the browser, not in Swagger)' })
  google(): void {
    // GoogleAuthGuard redirects to Google
  }

  @Public()
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(@Req() req: Request, @Res() res: Response): Promise<void> {
    const profile = req.user as GoogleProfile;
    const { tokens, isNew } = await this.authService.loginWithGoogle(profile, clientInfo(req));
    setAuthCookies(res, tokens, this.config.isProduction);
    const webUrl = this.config.get('WEB_URL');
    res.redirect(isNew ? `${webUrl}/accounts/onboarding` : webUrl);
  }

  @Get('socket-token')
  @ApiOperation({ summary: 'Short-lived token for the Socket.IO handshake (docs/spec/realtime.md)' })
  async socketToken(@CurrentUser() user: AuthUser): Promise<{ token: string }> {
    return { token: await this.authService.socketToken(user.id) };
  }
}

function clientInfo(req: Request): ClientInfo {
  return { userAgent: req.headers['user-agent'], ip: req.ip };
}

function refreshCookie(req: Request): string | undefined {
  return (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
}
