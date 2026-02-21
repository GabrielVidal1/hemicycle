import { Hemicycle } from "@hemicycle/core";
import {
  frAssembleeNationaleHemicycleProps,
  hemicycleData,
} from "@hemicycle/french-assemblee-nationale";
import { Tooltip } from "antd";

type Data = (typeof hemicycleData)[0];

const DeputeTooltipContent = ({ seatData }: { seatData: Data }) => {
  console.log("seatData", seatData);
  return (
    <div>
      <div>
        <strong>
          {seatData.extra?.nom} {seatData.extra?.prenom}
        </strong>
      </div>
      <div>{seatData.extra?.groupe?.libelle}</div>
      <div>Place numéro: {seatData.extra?.placeNumero}</div>
    </div>
  );
};

export const FrenchAssembleeNationale = () => {
  const data = hemicycleData.map((seat) => ({
    ...seat,
    color: seat.color || "#dddddd",
  }));

  return (
    <div>
      <h1 className="mb-6">French Assemblee Nationale</h1>

      <Hemicycle.WithAisles
        {...frAssembleeNationaleHemicycleProps}
        data={data}
        seatConfig={{
          shape: "arc",
          borderRadius: 1,
          seatMargin: 0.8,
          color: "#dddddd",
          wrapper: (content: React.ReactNode, seatData) => {
            if (!seatData?.extra) return <g>{content}</g>;

            return (
              <Tooltip
                title={<DeputeTooltipContent seatData={seatData as Data} />}
                placement="top"
              >
                <g className="pointer-events-auto cursor-pointer">{content}</g>
              </Tooltip>
            );
          },
        }}
      />
    </div>
  );
};

export default FrenchAssembleeNationale;
