import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import {
  ContextModule,
  JwtAuthGuard,
  JwtStrategy,
  JWT_AUTH_OPTIONS,
  SessionRepository,
} from '@sociflow/auth'
import { OAuthService, OAuthStateRepository } from '@sociflow/oauth'
import { APP_CONFIG, type AppConfig } from '../../config'
import { UserModule } from '../user/user.module'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { GoogleAuthController } from './google-auth.controller'
import { GoogleAuthService } from './google-auth.service'

@Module({
  imports: [
    ContextModule,
    UserModule,
    PassportModule,
    JwtModule.register({}),       // secret/expiry passed per-sign trong AuthService
  ],
  controllers: [AuthController, GoogleAuthController],
  providers: [
    AuthService,
    GoogleAuthService,
    OAuthService,
    OAuthStateRepository,
    SessionRepository,
    JwtStrategy,
    {
      provide: JWT_AUTH_OPTIONS,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        jwtAccessSecret: config.auth.jwtAccessSecret,
        accessCookieName: config.auth.accessCookieName,
      }),
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
  exports: [AuthService, SessionRepository, OAuthService, OAuthStateRepository],
})
export class AuthModule {}
