import { Redis } from "ioredis";

const globalForRedis = globalThis as unknown as { redis: Redis | null };

function createRedis(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url || url.includes("YOUR_PASSWORD") || url.includes("YOUR_ENDPOINT")) {
    console.warn("[Redis] REDIS_URL not configured — background workers disabled. App still works.");
    return null;
  }
  try {
    const client = new Redis(url, { maxRetriesPerRequest: null, lazyConnect: true });
    client.on("error", (err) => console.error("[Redis]", err.message));
    return client;
  } catch (err) {
    console.warn("[Redis] Failed to initialize — background workers disabled.");
    return null;
  }
}

export const redis = globalForRedis.redis !== undefined ? globalForRedis.redis : createRedis();

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;
