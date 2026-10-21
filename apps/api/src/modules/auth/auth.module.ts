import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AppConfigService } from '../../config/app-config.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleAuthGuard } from './google-auth.guard';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TokensService } from './tokens.service';

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokensService,
    JwtStrategy,
    GoogleAuthGuard,
    {
      // passport-google-oauth20 throws without a client id,
      // so the strategy is created only when Google keys are configured.
      provide: GoogleStrategy,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) =>
        config.isGoogleEnabled ? new GoogleStrategy(config) : null,
    },
  ],
  exports: [TokensService],
})
export class AuthModule {}
