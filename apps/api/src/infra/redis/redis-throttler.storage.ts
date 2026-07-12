import { Injectable } from "@nestjs/common";
import type { ThrottlerStorage } from "@nestjs/throttler";
import { RedisService } from "./redis.service";

// Atomic INCR + PEXPIRE + block-flag in one round trip so concurrent
// requests across horizontally-scaled API instances can't race past the
// limit between a read and a write (the failure mode of SELECT-then-UPDATE
// rate limiting).
const INCREMENT_SCRIPT = `
local hitsKey = KEYS[1]
local blockKey = KEYS[2]
local ttl = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local blockDuration = tonumber(ARGV[3])

local blockTtl = redis.call('PTTL', blockKey)
if blockTtl and blockTtl > 0 then
  local hits = tonumber(redis.call('GET', hitsKey) or '0')
  local hitsTtl = redis.call('PTTL', hitsKey)
  if hitsTtl < 0 then hitsTtl = 0 end
  return {hits, hitsTtl, 1, blockTtl}
end

local hits = redis.call('INCR', hitsKey)
if hits == 1 then
  redis.call('PEXPIRE', hitsKey, ttl)
end
local hitsTtl = redis.call('PTTL', hitsKey)
if hitsTtl < 0 then hitsTtl = ttl end

local isBlocked = 0
local blockTtlResult = 0
if hits > limit then
  redis.call('SET', blockKey, 1, 'PX', blockDuration)
  isBlocked = 1
  blockTtlResult = blockDuration
end

return {hits, hitsTtl, isBlocked, blockTtlResult}
`;

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly redisService: RedisService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ) {
    const base = `throttle:${throttlerName}:${key}`;
    const [hits, hitsTtlMs, isBlockedFlag, blockTtlMs] = (await this.redisService.client.eval(
      INCREMENT_SCRIPT,
      2,
      `${base}:hits`,
      `${base}:blocked`,
      ttl,
      limit,
      blockDuration,
    )) as [number, number, number, number];

    return {
      totalHits: hits,
      timeToExpire: Math.ceil(hitsTtlMs / 1000),
      isBlocked: isBlockedFlag === 1,
      timeToBlockExpire: Math.ceil(blockTtlMs / 1000),
    };
  }
}
