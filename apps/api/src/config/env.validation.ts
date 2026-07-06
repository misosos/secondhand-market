import { plainToInstance } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  validateSync,
} from "class-validator";

enum NodeEnv {
  development = "development",
  production = "production",
  test = "test",
}

// Fails fast at boot if required env vars are missing/malformed, instead of
// surfacing as a cryptic runtime error the first time a module reads them.
class EnvironmentVariables {
  @IsEnum(NodeEnv)
  @IsOptional()
  NODE_ENV: NodeEnv = NodeEnv.development;

  @IsInt()
  @Min(1)
  @IsOptional()
  API_PORT: number = 4000;

  @IsString()
  @IsNotEmpty()
  CORS_ORIGIN!: string;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  REDIS_URL!: string;

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_EXPIRES_IN!: string;

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_EXPIRES_IN!: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  REPORT_BLOCK_THRESHOLD: number = 5;

  @IsInt()
  @Min(1)
  @IsOptional()
  THROTTLE_TTL_MS: number = 60_000;

  @IsInt()
  @Min(1)
  @IsOptional()
  THROTTLE_LIMIT: number = 100;

  @IsString()
  @IsOptional()
  S3_ENDPOINT?: string;

  @IsString()
  @IsNotEmpty()
  S3_REGION!: string;

  @IsString()
  @IsNotEmpty()
  S3_BUCKET!: string;

  @IsString()
  @IsOptional()
  S3_ACCESS_KEY_ID?: string;

  @IsString()
  @IsOptional()
  S3_SECRET_ACCESS_KEY?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  S3_PRESIGNED_URL_EXPIRES_IN: number = 300;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(`Invalid environment variables:\n${errors.toString()}`);
  }

  return validated;
}
