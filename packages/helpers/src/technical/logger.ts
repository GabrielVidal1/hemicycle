import { TEST_ENV } from "./environment";

export const logger = {
  warn: (message: string) => {
    if (TEST_ENV) return;
    console.warn(message);
  },
  error: (message: string) => {
    if (TEST_ENV) return;
    console.error(message);
  },
};
