export const serial = (
  fns: Array<(previousResult: any) => Promise<any>>,
  initialValue: any
) =>
  fns.reduce(
    (chained, fn) => chained.then(previousResult => fn(previousResult)),
    Promise.resolve(initialValue)
  );

// export const parallel
