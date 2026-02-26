import { useEffect, useRef, useState } from "react";
import CodeBlock from "../components/CodeBlock";
import { CorePreview } from "../components/CorePreview";
import { HemicycleSVG } from "../components/ExampleHemicycle";
import { ExternalLink } from "../components/ExternalLink";
import { Footer } from "../components/Footer";
import { Navbar } from "../components/Navbar";
import { PackageCard, PkgCardProps } from "../components/PackageCard";
import { ReactPreview } from "../components/ReactPreview";
import { VanillaPreview } from "../components/VanillaPreview";

const PACKAGES: PkgCardProps[] = [
  {
    name: "@hemicycle/react",
    description:
      "Drop-in React component. Per-seat wrappers, click handlers, full TypeScript generics.",
    npmUrl: "https://www.npmjs.com/package/@hemicycle/react",
    version: "v0.1.3",
    accent: "linear-gradient(90deg, #FF0000, #FF00FF)",
  },
  {
    name: "@hemicycle/vanilla",
    description:
      "Framework-free SVG renderer. Works anywhere a DOM exists — no React required.",
    npmUrl: "https://www.npmjs.com/package/@hemicycle/vanilla",
    version: "v0.1.3",
    accent: "linear-gradient(90deg, #00FFFF, #0000FF)",
  },
  {
    name: "@hemicycle/core",
    description:
      "Pure geometry engine. Coordinates, indices, aisles. Zero rendering dependencies.",
    npmUrl: "https://www.npmjs.com/package/@hemicycle/core",
    version: "v0.1.3",
    accent: "linear-gradient(90deg, #00FF00, #00FFFF)",
  },
];

const INSTALL_SNIPPETS: Record<string, string> = {
  react: `npm install @hemicycle/react`,
  vanilla: `npm install @hemicycle/vanilla`,
  core: `npm install @hemicycle/core`,
};

const USAGE_SNIPPETS: Record<string, string> = {
  react: `import { Hemicycle } from "@hemicycle/react";

<Hemicycle
  rows={4}
  totalSeats={80}
  orderBy="radial"
  data={members.map((m) => ({
    idx: m.seatNumber,
    seatConfig: { color: m.partyColor },
  }))}
/>`,
  vanilla: `import { Hemicycle } from "@hemicycle/vanilla";

const chart = new Hemicycle({
  rows: 4,
  totalSeats: 80,
  orderBy: "radial"
});

chart.updateData(
  members.map((m) => ({
    idx: m.seatNumber,
    seatConfig: { color: m.partyColor },
  }))
);

chart.render(document.querySelector("svg"));`,
  core: `import { Hemicycle } from "@hemicycle/core";

const chart = new Hemicycle({
  rows: 4,
  totalSeats: 80,
  orderBy: "radial"
});

const layout = chart.getSeatsLayout();
// layout[i] → { x, y, innerR, outerR, angle1Rad, angle2Rad, ... }`,
};

export default function Home() {
  const [animated, setAnimated] = useState(false);
  const [activeTab, setActiveTab] = useState<"react" | "vanilla" | "core">(
    "react",
  );
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white selection:bg-white selection:text-black">
      {/* ── Noise texture overlay ── */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "128px",
        }}
      />

      <Navbar />

      {/* ── Hero ── */}
      <section
        ref={heroRef}
        className="px-6 md:px-12 pt-20 pb-10 max-w-6xl mx-auto"
      >
        <div className="grid md:grid-cols-5 gap-10 items-center">
          <div className="col-span-2">
            <div
              className="font-mono text-xs tracking-widest text-white/30 uppercase mb-6"
              style={{
                opacity: animated ? 1 : 0,
                transform: animated ? "none" : "translateY(8px)",
                transition: "opacity 0.6s ease, transform 0.6s ease",
              }}
            >
              Parliament · Assembly · Chamber
            </div>
            <h1
              className="text-4xl md:text-7xl font-black tracking-tighter leading-none mb-6"
              style={{
                fontFamily: "'Georgia', serif",
                opacity: animated ? 1 : 0,
                transform: animated ? "none" : "translateY(16px)",
                transition: "opacity 0.6s ease 0.1s, transform 0.6s ease 0.1s",
              }}
            >
              Hemi
              <span
                style={{
                  background:
                    "linear-gradient(90deg, #FF0000, #FFFF00, #00FF00, #00FFFF, #0000FF, #FF00FF)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                cycle
              </span>
              {/* <span className="text-3xl ml-1 tracking-normal">.dev</span> */}
            </h1>
            <p
              className="text-white/60 text-lg leading-relaxed mb-8 max-w-sm"
              style={{
                opacity: animated ? 1 : 0,
                transform: animated ? "none" : "translateY(16px)",
                transition: "opacity 0.6s ease 0.2s, transform 0.6s ease 0.2s",
              }}
            >
              TypeScript library for rendering parliament-style seat charts.
              React, vanilla JS, or layout-only — pick what fits.
            </p>
            <div
              className="flex items-center gap-4"
              style={{
                opacity: animated ? 1 : 0,
                transform: animated ? "none" : "translateY(16px)",
                transition: "opacity 0.6s ease 0.3s, transform 0.6s ease 0.3s",
              }}
            >
              <a
                href="#install"
                className="font-mono text-sm px-6 py-2.5 bg-white text-black hover:bg-white/90 transition-colors"
              >
                Get started
              </a>
              <ExternalLink
                href="https://github.com/GabrielVidal1/hemicycle"
                label="View on GitHub"
              />
            </div>
          </div>

          {/* Hemicycle visual */}
          <div
            className="col-span-3 relative"
            style={{
              opacity: animated ? 1 : 0,
              transition: "opacity 0.4s ease 0.2s",
            }}
          >
            {/* Subtle glow behind the chart */}
            <div
              className="absolute inset-0 blur-3xl opacity-20 pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse at center bottom, rgba(255,255,255,0.3) 0%, transparent 70%)",
              }}
            />
            <HemicycleSVG animated={animated} />
          </div>
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="border-t border-white/10 mx-6 md:mx-12" />

      {/* ── Stats strip ── */}
      <section className="px-6 md:px-12 py-8 max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { label: "Dependencies", value: "0" },
            { label: "Packages", value: "core · vanilla · react" },
            { label: "Customizability", value: "geometry + rendering" },
            { label: "License", value: "MIT" },
          ].map(({ label, value }) => (
            <div key={label}>
              <div className="font-mono text-xs text-white/30 uppercase tracking-widest mb-1">
                {label}
              </div>
              <div className="font-mono text-white text-sm">{value}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="border-t border-white/10 mx-6 md:mx-12" />

      {/* ── Packages ── */}
      <section className="px-6 md:px-12 py-16 max-w-6xl mx-auto">
        <h2 className="font-mono text-xs text-white/30 uppercase tracking-widest mb-8">
          Packages
        </h2>
        <div className="grid md:grid-cols-3 gap-px bg-white/10">
          {PACKAGES.map((pkg) => (
            <PackageCard key={pkg.name} {...pkg} />
          ))}
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="border-t border-white/10 mx-6 md:mx-12" />

      {/* ── Install + Usage ── */}
      <section id="install" className="px-6 md:px-12 py-16 max-w-6xl mx-auto">
        <h2 className="font-mono text-xs text-white/30 uppercase tracking-widest mb-8">
          Quick Start
        </h2>

        {/* Tab bar */}
        <div className="flex border-b border-white/10">
          {(["react", "vanilla", "core"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`font-mono text-sm px-5 py-2.5 border-b-2 transition-colors duration-150 ${
                activeTab === tab
                  ? "border-white text-white"
                  : "border-transparent text-white/30 hover:text-white/60"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* ── Code + Preview side-by-side ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 rounded-xl overflow-hidden border border-white/10 mt-4">
          {/* Left: install + usage code */}
          <div className="flex flex-col divide-y divide-white/10 col-span-2">
            <div className="p-4">
              <p className="text-white/30 text-xs font-mono uppercase tracking-widest mb-2">
                Install
              </p>
              <CodeBlock code={INSTALL_SNIPPETS[activeTab]} language="bash" />
            </div>
            <div className="p-4">
              <p className="text-white/30 text-xs font-mono uppercase tracking-widest mb-2">
                Usage
              </p>
              <CodeBlock code={USAGE_SNIPPETS[activeTab]} language="jsx" />
            </div>
          </div>

          {/* Right: live preview */}
          <div className="flex justify-center p-8 bg-white/2 border-l border-white/10 min-h-60 py-16">
            {activeTab === "react" && <ReactPreview />}
            {activeTab === "vanilla" && <VanillaPreview />}
            {activeTab === "core" && <CorePreview />}
          </div>
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="border-t border-white/10 mx-6 md:mx-12" />

      {/* ── Feature grid ── */}
      <section className="px-6 md:px-12 py-16 max-w-6xl mx-auto">
        <h2 className="font-mono text-xs text-white/30 uppercase tracking-widest mb-8">
          Features
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[
            {
              title: "Concentric rows",
              body: "Distribute seats proportionally across rows by arc length, or specify counts manually.",
            },
            {
              title: "Angular & arc aisles",
              body: "Insert radial gaps to separate party groups, or concentric walkways between row bands.",
            },
            {
              title: "Three seat shapes",
              body: "Arc wedges, rectangles, or circles — each with configurable radius and border radius.",
            },
            {
              title: "Per-seat data",
              body: "Map any typed data to seats by index or by (row, seat) coordinate. Unmapped seats stay neutral.",
            },
            {
              title: "Radial & row ordering",
              body: "Choose row-major or radial-major index assignment to match your data source.",
            },
            {
              title: "TypeScript generics",
              body: "Full end-to-end type safety from your data model through to rendered SVG attributes.",
            },
          ].map(({ title, body }) => (
            <div key={title} className="border-l border-white/10 pl-5">
              <div className="text-white text-sm font-semibold mb-1.5">
                {title}
              </div>
              <div className="text-white/40 text-sm leading-relaxed">
                {body}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="border-t border-white/10 mx-6 md:mx-12" />

      {/* ── Footer ── */}
      <Footer />
    </div>
  );
}
