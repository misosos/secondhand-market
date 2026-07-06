import { ArgumentsHost, Catch, HttpException } from "@nestjs/common";
import { BaseWsExceptionFilter, WsException } from "@nestjs/websockets";

// Nest's default WS exception handling only special-cases WsException —
// anything else (including the BadRequestException ValidationPipe throws
// on a failed DTO) falls through to a generic "Internal server error",
// discarding the actual validation messages. Confirmed by testing an
// invalid chat:send payload and getting no useful error back.
@Catch()
export class WsExceptionsFilter extends BaseWsExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      const message =
        typeof response === "string"
          ? response
          : ((response as { message?: string | string[] }).message ?? exception.message);
      super.catch(new WsException(message), host);
      return;
    }
    super.catch(exception as Error, host);
  }
}
