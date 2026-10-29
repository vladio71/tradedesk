import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { requestIdMiddleware } from './request-id.middleware';

export interface ConfigureAppOptions {
  /** For example `api/identity`. */
  globalPrefix: string;
  title: string;
}

/** Everything that main.ts and the e2e tests must do the same way. */
export function configureApp(app: INestApplication, options: ConfigureAppOptions): void {
  app.use(requestIdMiddleware);
  app.use(cookieParser());
  app.setGlobalPrefix(options.globalPrefix);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle(options.title)
      .setVersion('1.0')
      .addCookieAuth('access_token')
      .build(),
  );
  SwaggerModule.setup('docs', app, document);
}
