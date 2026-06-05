/**
 * Debounce: run `fn` only after `delay` ms have passed without another call.
 * Use for search boxes, autocomplete, resize-after-idle, etc.
 *
 * Same general shape as `throttle(fn, delay)`: returns a new function that
 * forwards `this` and arguments to `fn` when the debounced call finally runs.
 *
 * @template {(...args: any[]) => any} T
 * @param {T} fn
 * @param {number} delay milliseconds
 * @returns {T}
 */
export function debounce(fn, delay) {
  /** @type {ReturnType<typeof setTimeout> | null} */
  let timerId = null;

  return /** @type {T} */ (
    function (...args) {
      if (timerId != null) clearTimeout(timerId);
      const ctx = this;
      timerId = setTimeout(() => {
        timerId = null;
        fn.apply(ctx, args);
      }, delay);
    }
  );
}
