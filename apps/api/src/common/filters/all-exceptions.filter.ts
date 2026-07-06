import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";

interface ErrorResponseBody {
  statusCode: number;
  message: string | string[];
  error: string;
  path: string;
  timestamp: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();

    const isHttpException = exception instanceof HttpException;
    const statusCode = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    if (!isHttpException) {
      this.logger.error(exception instanceof Error ? exception.stack : exception);
    }

    const body: ErrorResponseBody = {
      statusCode,
      message: this.extractMessage(exception, isHttpException),
      error: isHttpException ? exception.constructor.name : "InternalServerError",
      path: httpAdapter.getRequestUrl(ctx.getRequest()),
      timestamp: new Date().toISOString(),
    };

    httpAdapter.reply(ctx.getResponse(), body, statusCode);
  }

  private extractMessage(exception: unknown, isHttpException: boolean): string | string[] {
    if (!isHttpException) return "Internal server error";

    const response = (exception as HttpException).getResponse();
    if (typeof response === "string") return response;

    const message = (response as { message?: string | string[] }).message;
    return message ?? (exception as HttpException).message;
  }
}
