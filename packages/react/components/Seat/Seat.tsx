import { useMemo } from "react";
import { seatPathGenerators } from "./shapes";
import { SeatConfig, SeatData } from "./types";

type SeatRendererProp<T extends object> = SeatConfig<T> & SeatData<T>;

export const SeatRenderer = <T extends object>(data: SeatRendererProp<T>) => {
  const {
    idx,
    color,
    wrapper,
    shape,
    props: svgProps,
    angle1Rad,
    angle2Rad,
    innerR,
    outerR,
    borderRadius,
  } = data;

  const path = useMemo(() => {
    return seatPathGenerators[shape ?? "arc"]({
      innerR,
      outerR,
      angle1Rad,
      angle2Rad,
      borderRadius,
    });
  }, [shape, innerR, outerR, angle1Rad, angle2Rad, borderRadius]);

  const seatWrapper = wrapper ?? ((a: React.ReactNode) => a);

  return seatWrapper(
    <path
      key={idx}
      d={path}
      fill={color}
      style={{
        pointerEvents: "auto",
      }}
      {...svgProps}
    />,
    data,
  );
};
