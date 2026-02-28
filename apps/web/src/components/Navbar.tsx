import { BookOpen, Github, Menu, Package, Play, X } from "lucide-react";
import { useState } from "react";
import { ExternalLink } from "./ExternalLink";

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="border-b border-white/10 px-4 md:px-12 py-4 sticky top-0 bg-black/90 backdrop-blur-sm z-50">
      <div className="flex items-center justify-between">
        {/* Logo */}
        <a
          href="/"
          className="font-mono text-sm tracking-widest uppercase text-white/80 hover:text-white transition-colors"
        >
          hemicycle.dev
        </a>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-6">
          <ExternalLink
            href="https://github.com/GabrielVidal1/hemicycle"
            label={
              <span className="flex items-center gap-2">
                <Github size={16} /> GitHub
              </span>
            }
          />

          <ExternalLink
            href="https://www.npmjs.com/package/@hemicycle/core"
            label={
              <span className="flex items-center gap-2">
                <Package size={16} /> npm
              </span>
            }
          />

          <a
            href="/playground"
            className="rainbow-btn relative px-4 py-1.5 font-mono text-sm text-white overflow-hidden bg-black transition-colors duration-300 flex items-center gap-2"
          >
            <Play size={16} className="mix-blend-difference" />
            <span className="mix-blend-difference">Playground</span>
          </a>

          <a
            href="https://docs.hemicycle.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-mono px-4 py-1.5 bg-white text-black hover:bg-white/80 transition-colors duration-150 flex items-center gap-2"
          >
            <BookOpen size={16} /> Docs
          </a>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setOpen(!open)}
          className="md:hidden text-white/80 hover:text-white"
          aria-label="Toggle menu"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {open && (
        <div className="md:hidden mt-4 flex flex-col gap-3 pb-2">
          <div className="flex gap-3">
            <ExternalLink
              href="https://github.com/GabrielVidal1/hemicycle"
              label={
                <span className="flex items-center gap-2">
                  <Github size={16} /> GitHub
                </span>
              }
            />

            <ExternalLink
              href="https://www.npmjs.com/package/@hemicycle/core"
              label={
                <span className="flex items-center gap-2">
                  <Package size={16} /> npm
                </span>
              }
            />
          </div>

          <a
            href="/playground"
            className="rainbow-btn relative px-4 py-1.5 font-mono text-sm text-white overflow-hidden bg-black transition-colors duration-300 flex items-center gap-2"
          >
            <Play size={16} className="mix-blend-difference" />
            <span className="mix-blend-difference">Playground</span>
          </a>

          <a
            href="https://docs.hemicycle.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-mono px-4 py-2 bg-white text-black hover:bg-white/80 transition-colors duration-150 flex items-center gap-2"
          >
            <BookOpen size={16} /> Docs
          </a>
        </div>
      )}
    </nav>
  );
}
