/**
 * Generic cache interface for storing key-value pairs.
 */
export interface Cache<T> {
  /** Retrieve a value by key. Returns undefined if not found or expired. */
  get(key: string): T | undefined;

  /** Store a value with an optional TTL in milliseconds. */
  set(key: string, value: T, ttlMs?: number): void;

  /** Delete a value by key. Returns true if the key existed. */
  delete(key: string): boolean;

  /** Check if a key exists and is not expired. */
  has(key: string): boolean;

  /** Remove all entries from the cache. */
  clear(): void;
}

// Implement the Cache<T> interface below as a class called MemoryCache<T>.
// Use a Map internally for storage.
