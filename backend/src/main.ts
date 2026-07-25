import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Railway (and most PaaS platforms) terminate TLS and proxy requests
  // through their edge layer; without this, Express's req.ip reflects the
  // proxy's immediate peer address rather than X-Forwarded-For, which can
  // vary per request and makes the IP-keyed rate limiter below unreliable.
  app.set('trust proxy', 1);
  app.use(helmet());
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  });
  // Document uploads carry base64 file content (up to ~7.5MB decoded) in the
  // JSON body, well over Express's 100kb default limit. `verify` stashes the
  // exact raw bytes on the request so the Paystack webhook can check its HMAC
  // signature against the same bytes Paystack signed, not a re-serialized copy.
  app.useBodyParser('json', {
    limit: '10mb',
    verify: (req: { rawBody?: Buffer }, _res, buf: Buffer) => {
      req.rawBody = buf;
    },
  });
  app.useBodyParser('urlencoded', { limit: '10mb', extended: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
