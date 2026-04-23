import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URI || process.env.REDIS_URL;
const hasRedisConfig = Boolean(redisUrl || process.env.REDIS_HOST);

let redisClient;

if (hasRedisConfig) {
    redisClient = redisUrl
        ? new Redis(redisUrl, {
            retryStrategy: (times) => Math.min(times * 50, 2000),
            maxRetriesPerRequest: 1,
            enableOfflineQueue: false,
            lazyConnect: true
        })
        : new Redis({
            host: process.env.REDIS_HOST,
            port: Number(process.env.REDIS_PORT || 6379),
            password: process.env.REDIS_PASSWORD || undefined,
            username: process.env.REDIS_USERNAME || undefined,
            retryStrategy: (times) => Math.min(times * 50, 2000),
            maxRetriesPerRequest: 1,
            enableOfflineQueue: false,
            lazyConnect: true
        });

    redisClient.on('error', (err) => {
        console.error('Redis connection error:', err.message);
    });

    redisClient.on('connect', () => {
        console.log('Redis connected');
    });
} else {
    const noop = async () => null;

    redisClient = {
        connect: async () => null,
        get: noop,
        set: noop,
        quit: async () => null,
        status: 'disabled'
    };

    console.log('Redis not configured. Continuing without Redis.');
}

export default redisClient;
