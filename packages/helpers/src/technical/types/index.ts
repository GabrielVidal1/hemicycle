export type WithOptionnal<T, K extends keyof T> = Omit<T, K> &
  Partial<Pick<T, K>>;

export type DeepMerge<A extends object, B extends object> = {
  [K in keyof A | keyof B]: K extends keyof A
    ? K extends keyof B
      ? A[K] extends object
        ? B[K] extends object
          ? DeepMerge<A[K], B[K]> // recurse
          : B[K]
        : B[K]
      : A[K]
    : K extends keyof B
      ? B[K]
      : never;
};
