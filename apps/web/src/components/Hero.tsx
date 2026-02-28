import { HemicycleSVG } from "./ExampleHemicycle";
import { ExternalLink } from "./ExternalLink";

interface HeroProps {
  animate: boolean;
  disableAnimation?: boolean;
  heroRef?: React.RefObject<HTMLDivElement>;
}

export function Hero({
  animate: animated,
  disableAnimation,
  heroRef,
}: HeroProps) {
  const opacityStyle =
    animated || disableAnimation ? { opacity: 1 } : { opacity: 0 };

  return (
    <section
      ref={heroRef}
      className="px-6 md:px-12 pt-20 pb-10 max-w-6xl mx-auto"
    >
      <div className="grid md:grid-cols-5 gap-10 items-center">
        <div className="col-span-2">
          <div
            className="font-mono text-xs tracking-widest text-white/30 uppercase mb-6"
            style={{
              ...opacityStyle,
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
              ...opacityStyle,
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
              ...opacityStyle,
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
              ...opacityStyle,
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
          className="col-span-3 relative overflow-clip"
          style={{
            ...opacityStyle,
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
          <HemicycleSVG
            animated={animated}
            disableAnimation={disableAnimation}
          />
        </div>
      </div>
    </section>
  );
}
