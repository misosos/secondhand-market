import { IsOptional, IsString, MaxLength } from "class-validator";
import { SanitizeHtml } from "../../../common/decorators/sanitize-html.decorator";

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @SanitizeHtml()
  bio?: string;
}
