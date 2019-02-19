export const serial = <T>(
  fns: Array<(previousResult: T) => Promise<T>>,
  initialValue: T
): Promise<T> =>
  fns.reduce(
    (chained, fn) => chained.then(previousResult => fn(previousResult)),
    Promise.resolve(initialValue)
  );

// export const parallel
