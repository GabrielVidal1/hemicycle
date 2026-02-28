import { Move3d, Rainbow, Shapes, TableColumnsSplit } from "lucide-react";
import SeatsSVG from "../../icons/seats.svg";
import TypescriptSVG from "../../icons/typescript.svg";

export const Features = () => {
  return (
    <section className="px-6 md:px-12 py-16 max-w-6xl mx-auto">
      <h2 className="font-mono text-xs text-white/30 uppercase tracking-widest mb-8">
        Features
      </h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {[
          {
            icon: <Rainbow size={16} strokeWidth={1.5} />,
            title: "Concentric rows",
            body: "Distribute seats proportionally across rows by arc length, or specify counts manually.",
          },
          {
            icon: <TableColumnsSplit size={16} strokeWidth={1.5} />,
            title: "Angular & arc aisles",
            body: "Insert radial gaps to separate party groups, or concentric walkways between row bands.",
          },
          {
            icon: <Shapes size={16} strokeWidth={1.5} />,
            title: "Three seat shapes",
            body: "Arc wedges, rectangles, or circles — each with configurable radius and border radius.",
          },
          {
            icon: <img src={SeatsSVG} alt="Seats" className="w-4 h-4" />,
            title: "Per-seat data",
            body: "Map any typed data to seats by index or by (row, seat) coordinate. Unmapped seats stay neutral.",
          },
          {
            icon: <Move3d size={16} strokeWidth={1.5} />,
            title: "Radial & row ordering",
            body: "Choose row-major or radial-major index assignment to match your data source.",
          },
          {
            icon: (
              <img src={TypescriptSVG} alt="TypeScript" className="w-4 h-4" />
            ),
            title: "TypeScript generics",
            body: "Full end-to-end type safety from your data model through to rendered SVG attributes.",
          },
        ].map(({ icon, title, body }) => (
          <div key={title} className="border-l border-white/10 pl-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="text-white/50 ">{icon}</div>
              <div className="text-white text-sm font-semibold">{title}</div>
            </div>
            <div className="text-white/40 text-sm leading-relaxed">{body}</div>
          </div>
        ))}
      </div>
    </section>
  );
};
