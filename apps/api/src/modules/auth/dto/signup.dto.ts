import { IsString, Length, Matches } from "class-validator";

export class SignupDto {
  @IsString()
  @Length(3, 20)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: "username may only contain letters, numbers, and underscores",
  })
  username: string;

  @IsString()
  @Length(8, 72) // bcrypt silently truncates beyond 72 bytes
  password: string;
}
