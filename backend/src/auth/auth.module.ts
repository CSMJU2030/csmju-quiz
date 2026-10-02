import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CoreHubTokenVerifier } from './core-hub-token.verifier';
import { CoreHubJwtGuard } from './guards/core-hub-jwt.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { JwksService } from './jwks.service';
import { MeController } from './me.controller';
import { SsoCallbackController } from './sso-callback.controller';

@Global()
@Module({
  controllers: [SsoCallbackController, MeController],
  providers: [
    JwksService,
    CoreHubTokenVerifier,
    // ทุก route ต้องล็อกอินโดยปริยาย · ยกเว้นที่ติด @Public()
    { provide: APP_GUARD, useClass: CoreHubJwtGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [CoreHubTokenVerifier, JwksService],
})
export class AuthModule {}
