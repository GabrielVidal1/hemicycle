import { computeViewBox } from "@hemicycle/rendering";
import { useMemo } from "react";
import { DEFAULT_HEMICYCLE_BASE_PROPS } from "./constant";
import { HemicycleContent } from "./HemicycleContent";
import { HemicycleProps } from "./HemicycleProps";
import { HemicycleWithAisles } from "./HemicycleWithAisles";

const Hemicycle = <T extends object = object>(props: HemicycleProps<T>) => {
  const { outerRadius, totalAngle, width, height, ...contentProps } = {
    ...DEFAULT_HEMICYCLE_BASE_PROPS,
    ...props,
  };

  const totalAngleRad = (totalAngle * Math.PI) / 180;

  const viewBox = useMemo(
    () => computeViewBox({ outerRadius, totalAngleRad }),
    [outerRadius, totalAngleRad],
  );

  return (
    <svg
      width={width ?? "100%"}
      height={height ?? "100%"}
      viewBox={viewBox}
      style={{ display: "block" }}
    >
      <HemicycleContent
        outerRadius={outerRadius}
        totalAngle={totalAngle}
        {...contentProps}
      />
    </svg>
  );
};

Hemicycle.WithAisles = HemicycleWithAisles;

export { Hemicycle };
