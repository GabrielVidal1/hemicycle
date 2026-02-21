// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PlainObject = Record<string, any>;

const isPlainObject = (value: unknown): value is PlainObject => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

export const merge = <T extends object>(...objects: Partial<T>[]): T => {
  const result = {} as T;

  for (const obj of objects) {
    if (!obj) continue;

    for (const key of Object.keys(obj) as (keyof T)[]) {
      const value = obj[key];

      if (value === undefined) continue;

      const existing = result[key];

      if (isPlainObject(existing) && isPlainObject(value)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        result[key] = merge(existing, value) as any;
      } else {
        result[key] = value as T[typeof key];
      }
    }
  }

  return result;
};
