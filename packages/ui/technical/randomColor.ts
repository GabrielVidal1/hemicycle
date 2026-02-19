import { mulberry32 } from "./mulberry32";

export const randomColor = (seed: number) => {
  const rng = mulberry32(seed);
  const h = Math.floor(rng() * 360);
  return `hsl(${h}, 100%, 60%)`;
};
