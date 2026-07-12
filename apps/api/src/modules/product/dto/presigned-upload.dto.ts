import { IsNotEmpty, IsString } from "class-validator";

export class PresignedUploadDto {
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @IsString()
  @IsNotEmpty()
  contentType: string;
}
