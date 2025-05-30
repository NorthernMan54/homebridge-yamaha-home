const NodeCache = require('node-cache');

class CachedYamaha {
  constructor(yamaha, options = {}) {
    this.yamaha = yamaha;
    this.cache = new NodeCache({
      stdTTL: options.stdTTL || 30, // Default TTL: 30 seconds
      checkperiod: options.checkperiod || 60, // Default check period: 60 seconds
    });
  }

  /**
   * Retrieves a cached value or fetches it if not cached.
   * @param {string} key - Cache key.
   * @param {Function} fetchFunction - Function to fetch value if not cached.
   * @returns {Promise<any>} - Cached or fetched value.
   */
  async getCached(key, fetchFunction) {
    if (this.cache.has(key)) {
      // console.log(`Cache hit for key: ${key}`);
      return this.cache.get(key);
    }
    try {
      const value = await fetchFunction();
      // console.log(`Cache miss for key: ${key}`);
      this.cache.set(key, value);
      return value;
    }
    catch (error) {
      console.error('Error fetching value:', key, this.yamaha.ip);
      return new Error('Communication Error');
    }
  }

  /**
   * Creates a proxy to cache all function calls on the Yamaha object.
   * Keys starting with "set" or "power" bypass caching.
   * @returns {Proxy} - Proxy-wrapped Yamaha instance.
   */
  createProxy() {
    return new Proxy(this.yamaha, {
      get: (target, prop) => {
        const originalMethod = target[prop];

        // If the property is a function, decide caching behavior
        if (typeof originalMethod === 'function') {
          return async (...args) => {
            const propName = String(prop).toLowerCase();

            // Bypass cache for methods starting with "set" or "power" party
            if (/^(set|power|send|select|party)/.test(propName)) {
              // console.log(`direct for key: ${propName}`);
              this.cache.flushAll(); // Clear the cache
              return originalMethod.apply(target, args);
            }

            // Cache other method results
            const cacheKey = `${prop}-${JSON.stringify(args)}`;
            return this.getCached(cacheKey, () => originalMethod.apply(target, args));
          };
        }

        // Otherwise, return the property directly
        return originalMethod;
      },
    });
  }
}

module.exports = CachedYamaha;
