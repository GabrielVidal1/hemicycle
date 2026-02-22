import { Hemicycle } from "@hemicycle/vanilla";
import { useEffect, useMemo, useRef } from "react";
import { HemicycleProps } from "./types";

const HemicycleComponent = <T extends object = object>({
  data,
  ...props
}: HemicycleProps<T>) => {
  const hemicycleRef = useRef<Hemicycle<T> | null>(new Hemicycle<T>(props));

  useEffect(() => {
    if (hemicycleRef.current) {
      hemicycleRef.current.updateConfig(props);
    }
  }, [props]);

  useEffect(() => {
    if (!hemicycleRef.current) return;
    hemicycleRef.current.updateData(data);

    return () => hemicycleRef?.current?.cleanUp();
  }, [data]);

  const seatData = useMemo(
    () => hemicycleRef.current?.getSeatData() ?? [],
    [data],
  );

  return (
    <svg
      ref={(el) => {
        if (el && hemicycleRef.current) {
          hemicycleRef.current.render(el);
        }
      }}
      style={{ display: "block" }}
      width={props.width ?? "100%"}
      height={props.height ?? "100%"}
    >
      {seatData.map(({ seatConfig }, idx) => {
        return (
          <path
            key={idx}
            d={seatConfig.path}
            fill={seatConfig.color ?? "lightgray"}
          />
        );
      })}
    </svg>
  );
};

export { HemicycleComponent as Hemicycle };
