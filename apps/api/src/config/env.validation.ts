import { plainToInstance } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  MinLength,
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

  // MinLength guards against a weak/short secret making JWTs forgeable by
  // brute force — applies in every env, including dev (.env.example ships a
  // 32+ char placeholder so `cp .env.example .env` still boots). A second
  // check below (in validateEnv, production-only) additionally refuses to
  // boot with .env.example's exact placeholder value still in place, since
  // that string is public (checked into this repo) and would make tokens
  // forgeable by anyone who's seen it.
  @IsString()
  @IsNotEmpty()
  @MinLength(32, { message: "JWT_ACCESS_SECRET must be at least 32 characters" })
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_EXPIRES_IN!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(32, { message: "JWT_REFRESH_SECRET must be at least 32 characters" })
  JWT_REFRESH_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_EXPIRES_IN!: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  REPORT_BLOCK_THRESHOLD: number = 5;

  @IsInt()
  @Min(0)
  @IsOptional()
  SIGNUP_INITIAL_BALANCE: number = 100_000;

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

// Exact values .env.example ships — fine to boot dev/test with (nothing
// sensitive reachable there), but must never reach a real deployment.
const PLACEHOLDER_JWT_SECRETS: Partial<Record<keyof EnvironmentVariables, string>> = {
  JWT_ACCESS_SECRET: "change-me-access-secret-please-generate-a-real-one",
  JWT_REFRESH_SECRET: "change-me-refresh-secret-please-generate-a-real-one",
};

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(`Invalid environment variables:\n${errors.toString()}`);
  }

  if (validated.NODE_ENV === NodeEnv.production) {
    for (const [key, placeholder] of Object.entries(PLACEHOLDER_JWT_SECRETS)) {
      if (validated[key as keyof EnvironmentVariables] === placeholder) {
        throw new Error(`${key} is still the .env.example placeholder — generate a real secret for production`);
      }
    }
  }

  return validated;
}
