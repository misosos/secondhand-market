import "reflect-metadata";
import { validateEnv } from "./env.validation";

describe("validateEnv", () => {
  const base = {
    NODE_ENV: "development",
    CORS_ORIGIN: "http://localhost:3000",
    DATABASE_URL: "postgresql://x",
    REDIS_URL: "redis://x",
    JWT_ACCESS_SECRET: "a".repeat(40),
    JWT_ACCESS_EXPIRES_IN: "15m",
    JWT_REFRESH_SECRET: "b".repeat(40),
    JWT_REFRESH_EXPIRES_IN: "7d",
    S3_REGION: "us-east-1",
    S3_BUCKET: "bucket",
  };

  it("accepts a well-formed config", () => {
    expect(() => validateEnv(base)).not.toThrow();
  });

  it("rejects a JWT secret shorter than 32 characters", () => {
    expect(() => validateEnv({ ...base, JWT_ACCESS_SECRET: "short" })).toThrow(/JWT_ACCESS_SECRET/);
    expect(() => validateEnv({ ...base, JWT_REFRESH_SECRET: "short" })).toThrow(/JWT_REFRESH_SECRET/);
  });

  it("allows .env.example's placeholder secrets outside production (local dev convenience)", () => {
    expect(() =>
      validateEnv({
        ...base,
        JWT_ACCESS_SECRET: "change-me-access-secret-please-generate-a-real-one",
        JWT_REFRESH_SECRET: "change-me-refresh-secret-please-generate-a-real-one",
      }),
    ).not.toThrow();
  });

  it("refuses to boot in production with .env.example's exact placeholder secret still in place", () => {
    expect(() =>
      validateEnv({
        ...base,
        NODE_ENV: "production",
        JWT_ACCESS_SECRET: "change-me-access-secret-please-generate-a-real-one",
      }),
    ).toThrow(/JWT_ACCESS_SECRET is still the .env.example placeholder/);

    expect(() =>
      validateEnv({
        ...base,
        NODE_ENV: "production",
        JWT_REFRESH_SECRET: "change-me-refresh-secret-please-generate-a-real-one",
      }),
    ).toThrow(/JWT_REFRESH_SECRET is still the .env.example placeholder/);
  });

  it("boots in production with a real, non-placeholder secret", () => {
    expect(() => validateEnv({ ...base, NODE_ENV: "production" })).not.toThrow();
  });
});
