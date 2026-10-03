import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { buildOpenApi, configureApp, GLOBAL_PREFIX_OPTIONS } from './app.setup';
import { JsonLogger, logEvent } from './common/logger';
import { AppConfig } from './config/app-config.service';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: new JsonLogger(),
  });
  app.disable('x-powered-by');
  // trust proxy ตั้งใน configureApp (TRUSTED_PROXY_HOPS = 1 · ผ่าน proxy ของ frontend)

  const config = app.get(AppConfig);
  // prefix ตั้งที่นี่ตรง ๆ (CI กฎ API-02 ตรวจใน main.ts)
  app.setGlobalPrefix('api', GLOBAL_PREFIX_OPTIONS);
  configureApp(app, config.get('FRONTEND_URL'), { withPrefix: false });

  if (!config.isProduction) {
    SwaggerModule.setup('api/docs', app, () => buildOpenApi(app));
  }
  app.enableShutdownHooks();

  const port = config.get('PORT');
  await app.listen(port);

  logEvent('subsystem.started', {
    subsystem: config.get('SUBSYSTEM_ID'),
    subsystemName: config.get('SUBSYSTEM_NAME'),
    port,
    coreHubUrl: config.get('CORE_HUB_URL'),
    jwksUrl: config.get('CORE_HUB_JWKS_URL'),
    issuer: config.get('CORE_HUB_ISSUER'),
    audience: config.get('CORE_HUB_AUDIENCE'),
  });
}

void bootstrap();
