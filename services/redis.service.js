import Redis from "ioredis";

const redisClient = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  username: process.env.REDIS_USERNAME || undefined,
  // Add retry strategy to avoid flooding logs if down
  retryStrategy: (times) => {
    // If it fails, wait 5 seconds before retrying, max 20 seconds
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  // Don't crash on connection error
  maxRetriesPerRequest: null,
  enableOfflineQueue: false, // Fail fast if not connected
});

// Suppress unhandled error logs
redisClient.on("error", (err) => {
  // Just log once or silently fail for development
  // console.log('Redis Client Error (Optional):', err.message);
});

redisClient.on("connect", () => {
  console.log("Redis connected");
});

export default redisClient;
