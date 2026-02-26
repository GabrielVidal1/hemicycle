import { ExternalLink } from "./ExternalLink";

export function Navbar() {
  return (
    <nav className="border-b border-white/10 px-6 md:px-12 py-4 flex items-center justify-between sticky top-0 bg-black/90 backdrop-blur-sm z-50">
      <a
        href="/"
        className="font-mono text-sm tracking-widest uppercase text-white/80 hover:text-white transition-colors"
      >
        hemicycle.dev
      </a>
      <div className="flex items-center gap-6">
        <ExternalLink
          href="https://github.com/GabrielVidal1/hemicycle"
          label="GitHub"
        />
        <ExternalLink
          href="https://www.npmjs.com/package/@hemicycle/core"
          label="npm"
        />

        <a
          href="/playground"
          className="rainbow-btn relative px-4 py-1.5 font-mono text-sm text-white overflow-hidden bg-black transition-colors duration-300"
        >
          <span>Playground</span>
        </a>
        <a
          href="https://docs.hemicycle.dev"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-mono px-4 py-1.5 bg-white text-black hover:bg-white/80 transition-colors duration-150"
        >
          Docs
        </a>
      </div>
    </nav>
  );
}
