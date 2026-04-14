/**
 * A simple asynchronous lock/deduplicator.
 * Ensures that multiple calls to the same long-running operation (identified by a key)
 * return the same promise while the operation is in flight.
 */
class AsyncLock {
  /**
   * Initialises a new instance of the AsyncLock class.
   */
  constructor() {
    this.pending = new Map();
  }

  /**
   * Executes an async function, or returns the existing promise if already running.
   *
   * @param {string} key - Unique identifier for the operation.
   * @param {Function} fn - The async function to execute.
   * @returns {Promise<any>} A promise that resolves to the result of the async function.
   */
  async run(key, fn) {
    if (this.pending.has(key)) {
      // console.log(`[AsyncLock] De-duplicating operation for key: ${key}`);
      return this.pending.get(key);
    }

    const promise = (async () => {
      try {
        return await fn();
      } finally {
        this.pending.delete(key);
      }
    })();

    this.pending.set(key, promise);
    return promise;
  }
}

module.exports = new AsyncLock();
