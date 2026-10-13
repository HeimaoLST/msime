/** One package read per path, with a shared count and size budget for the whole import. */
export function boundedResourceReader<T>(
  resolve: (relative: string) => Promise<T>,
  {
    maxResources,
    countError,
    sizeOf,
    validate,
  }: {
    maxResources: number;
    countError: string;
    sizeOf: (value: T) => number;
    validate: (value: T, total: number) => void;
  },
): (relative: string) => Promise<T> {
  const cache = new Map<string, Promise<T>>();
  let total = 0;
  return (relative) => {
    const cached = cache.get(relative);
    if (cached) return cached;
    if (cache.size >= maxResources) return Promise.reject(new Error(countError));
    const pending = resolve(relative).then((value) => {
      total += sizeOf(value);
      validate(value, total);
      return value;
    });
    cache.set(relative, pending);
    return pending;
  };
}
