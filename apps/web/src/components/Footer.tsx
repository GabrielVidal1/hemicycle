import { Heart } from "lucide-react";
import { ExternalLink } from "./ExternalLink";

export function Footer() {
  return (
    <footer className="px-6 md:px-12 py-10 max-w-6xl mx-auto flex flex-col-reverse md:flex-row items-center md:items-center justify-between gap-8">
      {/* Branding */}
      <div className="flex flex-col items-center md:items-start text-center md:text-left gap-2">
        <div className="font-mono text-xs text-white/30 uppercase tracking-widest">
          hemicycle.dev
        </div>

        <div className="text-white/30 text-sm flex gap-1 flex-nowrap items-center justify-center md:justify-start">
          Made with <Heart className="inline mb-0.5" size={15} fill="grey" /> by{" "}
          <a
            href="https://gabriel.vidal--ayrinhac.xyz/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/50 hover:text-white transition-colors"
          >
            Gabriel Vidal
          </a>
        </div>
      </div>

      {/* Links */}
      <div className="flex flex-wrap justify-center md:justify-end gap-x-8 gap-y-3">
        <ExternalLink
          href="https://www.npmjs.com/package/@hemicycle/core"
          label="@hemicycle/core"
        />
        <ExternalLink
          href="https://www.npmjs.com/package/@hemicycle/vanilla"
          label="@hemicycle/vanilla"
        />
        <ExternalLink
          href="https://www.npmjs.com/package/@hemicycle/react"
          label="@hemicycle/react"
        />
        <ExternalLink
          href="https://github.com/GabrielVidal1/hemicycle"
          label="GitHub"
        />
      </div>
    </footer>
  );
}
