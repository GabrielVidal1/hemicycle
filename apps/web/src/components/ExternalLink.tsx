interface ExternalLinkProps {
  href: string;
  label: string | React.ReactNode;
}

export function ExternalLink({ href, label }: ExternalLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-sm font-mono text-white/50 hover:text-white border-b border-white/0 hover:border-white/50 transition-all duration-150 pb-px"
    >
      {label}
      <svg
        className="w-3 h-3"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M7 17L17 7M7 7h10v10"
        />
      </svg>
    </a>
  );
}
