import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { DomainError, DomainErrorKind } from '../errors/domain-error';

const STATUS_BY_KIND: Record<DomainErrorKind, number> = {
  not_found: HttpStatus.NOT_FOUND,
  conflict: HttpStatus.CONFLICT,
  validation: HttpStatus.UNPROCESSABLE_ENTITY,
  unauthorized: HttpStatus.UNAUTHORIZED,
  forbidden: HttpStatus.FORBIDDEN,
};

export interface ErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details?: string[];
  requestId?: string;
  path: string;
  timestamp: string;
}

/** One error shape for the whole API. Unknown errors become a plain 500 and are logged. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request & { id?: string }>();

    const body = this.toBody(exception, request);
    if (body.statusCode >= 500) {
      this.logger.error(`[${body.requestId}] ${request.method} ${request.url}`, exception instanceof Error ? exception.stack : String(exception));
    }
    response.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown, request: Request & { id?: string }): ErrorBody {
    const base = { requestId: request.id, path: request.url, timestamp: new Date().toISOString() };

    if (exception instanceof DomainError) {
      return { statusCode: STATUS_BY_KIND[exception.kind], code: exception.code, message: exception.message, ...base };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const raw = typeof payload === 'object' && payload !== null ? (payload as { message?: string | string[] }).message : payload;
      const details = Array.isArray(raw) ? raw : undefined;
      const message = Array.isArray(raw) ? 'Validation failed' : String(raw ?? exception.message);
      return { statusCode: status, code: HttpStatus[status] ?? 'ERROR', message, details, ...base };
    }
    return { statusCode: 500, code: 'INTERNAL_ERROR', message: 'Internal server error', ...base };
  }
}
