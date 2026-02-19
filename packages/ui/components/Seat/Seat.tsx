import { useMemo } from "react";
import { seatPathGenerators } from "./shapes";
import { SeatConfig, SeatData, SeatShape } from "./types";

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
    borderRadius: roundedness,
  } = data;

  const path = useMemo(() => {
    const finalShape: SeatShape = shape ?? shape ?? "arc";
    return seatPathGenerators[finalShape]({
      innerR,
      outerR,
      angle1Rad,
      angle2Rad,
      cornerRadius: roundedness,
    });
  }, [shape, innerR, outerR, angle1Rad, angle2Rad, roundedness]);

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
