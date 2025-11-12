import redisClient from '../microservices/Redisserver.js';

/**
 * IP-based rate limiting for password reset requests
 * Limit: 20 requests per hour per IP
 */
export async function checkIpRateLimit(ip) {
  const key = `password_reset:rate:ip:${ip}`;
  const limit = 20;
  const window = 3600; // 1 hour in seconds

  try {
    // Atomic increment using Lua script
    const luaScript = `
      local key = KEYS[1]
      local limit = tonumber(ARGV[1])
      local window = tonumber(ARGV[2])
      
      local current = redis.call('GET', key)
      if current and tonumber(current) >= limit then
        return 1
      end
      
      local count = redis.call('INCR', key)
      if count == 1 then
        redis.call('EXPIRE', key, window)
      end
      
      return 0
    `;

    const result = await redisClient.eval(luaScript, {
      keys: [key],
      arguments: [limit.toString(), window.toString()]
    });

    return result === 1;
  } catch (error) {
    console.error('Error in IP rate limiting:', error);
    // Fail open: allow request if Redis is down
    return false;
  }
}

/**
 * User-based rate limiting for password reset requests
 * Limit: 5 requests per hour per user
 */
export async function checkUserRateLimit(userId) {
  const key = `password_reset:rate:user:${userId}`;
  const limit = 5;
  const window = 3600; // 1 hour in seconds

  try {
    const luaScript = `
      local key = KEYS[1]
      local limit = tonumber(ARGV[1])
      local window = tonumber(ARGV[2])
      
      local current = redis.call('GET', key)
      if current and tonumber(current) >= limit then
        return 1
      end
      
      local count = redis.call('INCR', key)
      if count == 1 then
        redis.call('EXPIRE', key, window)
      end
      
      return 0
    `;

    const result = await redisClient.eval(luaScript, {
      keys: [key],
      arguments: [limit.toString(), window.toString()]
    });

    return result === 1;
  } catch (error) {
    console.error('Error in user rate limiting:', error);
    return false;
  }
}

/**
 * Token-based rate limiting for password reset validation
 * Limit: 10 attempts per 5 minutes per token
 */
export async function checkTokenRateLimit(tokenId) {
  const key = `password_reset:validate:token:${tokenId}`;
  const limit = 10;
  const window = 300; // 5 minutes in seconds

  try {
    const luaScript = `
      local key = KEYS[1]
      local limit = tonumber(ARGV[1])
      local window = tonumber(ARGV[2])
      
      local current = redis.call('GET', key)
      if current and tonumber(current) >= limit then
        return 1
      end
      
      local count = redis.call('INCR', key)
      if count == 1 then
        redis.call('EXPIRE', key, window)
      end
      
      return 0
    `;

    const result = await redisClient.eval(luaScript, {
      keys: [key],
      arguments: [limit.toString(), window.toString()]
    });

    return result === 1;
  } catch (error) {
    console.error('Error in token rate limiting:', error);
    return false;
  }
}
