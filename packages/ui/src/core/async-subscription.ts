/** Owns an asynchronous listener registration until its caller is replaced or unmounted. */
export function trackAsyncSubscription(
  pending: Promise<() => void>,
  isCurrent: () => boolean,
): () => void {
  let disposed = false;
  let stop: (() => void) | undefined;
  void pending
    .then((unsubscribe) => {
      if (disposed || !isCurrent()) unsubscribe();
      else stop = unsubscribe;
    })
    .catch(() => undefined);
  return () => {
    disposed = true;
    stop?.();
    stop = undefined;
  };
}
