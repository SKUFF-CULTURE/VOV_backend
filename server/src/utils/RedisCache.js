const Redis = require("ioredis");
const redis = new Redis({
  host: process.env.REDIS_HOST || "redis",
  port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  password: process.env.REDIS_PASSWORD, // Пароль из переменной окружения
});

async function getCached(key, fetchFn, ttl = 300) {
  try {
    const cached = await redis.get(key);
    if (cached !== null) {
      console.log(`Cache hit for ${key}`);
      return JSON.parse(cached);
    }
    console.log(`Cache miss for ${key}`);
    const result = await fetchFn();
    // Кэшируем только если результат не пустой
    if (result && (Array.isArray(result) ? result.length > 0 : true)) {
      await redis.set(key, JSON.stringify(result), "EX", ttl);
    }
    return result;
  } catch (err) {
    console.error(`Redis error for ${key}:`, err);
    return await fetchFn(); // Fallback на БД
  }
}

async function invalidateCache(key) {
  try {
    await redis.del(key);
    console.log(`Cache invalidated for ${key}`);
  } catch (err) {
    console.error(`Error invalidating cache for ${key}:`, err);
  }
}

async function invalidateCacheByPrefix(prefix) {
  try {
    const keys = await redis.keys(`${prefix}*`);
    if (keys.length > 0) {
      await redis.del(keys);
      console.log(`Cache invalidated for prefix ${prefix}`);
    }
  } catch (err) {
    console.error(`Error invalidating cache for prefix ${prefix}:`, err);
  }
}

module.exports = { getCached, invalidateCache, invalidateCacheByPrefix };
