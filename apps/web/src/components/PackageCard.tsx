export interface PkgCardProps {
  name: string;
  description: string;
  npmUrl: string;
  version: string;
  accent: string;
}

export function PackageCard({
  name,
  description,
  npmUrl,
  version,
  accent,
}: PkgCardProps) {
  return (
    <a
      href={npmUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group block border border-white/20 p-6 hover:border-white transition-colors duration-200 relative overflow-hidden"
    >
      <div
        className="absolute top-0 left-0 h-0.5 w-0 group-hover:w-full transition-all duration-300"
        style={{ background: accent }}
      />
      <div className="flex items-start justify-between gap-4 mb-3">
        <span className="font-mono text-xs text-white/40">{version}</span>
        <svg
          className="w-4 h-4 text-white/30 group-hover:text-white transition-colors shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M7 17L17 7M7 7h10v10"
          />
        </svg>
      </div>
      <div className="font-mono text-white text-sm mb-2">{name}</div>
      <div className="text-white/50 text-sm leading-relaxed">{description}</div>
    </a>
  );
}
