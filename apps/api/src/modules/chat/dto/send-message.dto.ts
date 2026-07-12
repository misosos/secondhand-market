import { IsNotEmpty, IsString, IsUUID, Length } from "class-validator";
import { SanitizeHtml } from "../../../common/decorators/sanitize-html.decorator";
import { MAX_MESSAGE_LENGTH } from "../chat.constants";

export class SendMessageDto {
  @IsUUID()
  roomId: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, MAX_MESSAGE_LENGTH)
  @SanitizeHtml()
  content: string;
}
