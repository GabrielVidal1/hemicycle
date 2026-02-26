import { ExternalLink } from "./ExternalLink";

export function Footer() {
  return (
    <footer className="px-6 md:px-12 py-10 max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
      <div>
        <div className="font-mono text-xs text-white/30 uppercase tracking-widest mb-1">
          hemicycle.dev
        </div>
        <div className="text-white/30 text-sm">
          Made with ❤️ by{" "}
          <a
            href="mailto:gvidalayrinhac@gmail.com"
            className="text-white/50 hover:text-white transition-colors"
          >
            Gabriel Vidal
          </a>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-8 gap-y-3">
        <ExternalLink
          href="https://github.com/GabrielVidal1/hemicycle"
          label="GitHub"
        />
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
          href="https://github.com/GabrielVidal1/hemicycle/issues"
          label="Issues"
        />
      </div>
    </footer>
  );
}
