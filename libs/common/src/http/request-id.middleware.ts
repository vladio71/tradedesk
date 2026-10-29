import { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';

const logger = new Logger('HTTP');

/** Gives every request an id (or keeps the one sent by the gateway) and logs one line per request. */
export function requestIdMiddleware(request: Request & { id?: string }, response: Response, next: NextFunction): void {
  const incoming = request.headers['x-request-id'];
  const id = typeof incoming === 'string' && incoming.length > 0 && incoming.length <= 100 ? incoming : randomUUID();
  request.id = id;
  response.setHeader('X-Request-Id', id);

  const startedAt = Date.now();
  response.on('finish', () => {
    logger.log(`[${id}] ${request.method} ${request.originalUrl} ${response.statusCode} ${Date.now() - startedAt}ms`);
  });
  next();
}
