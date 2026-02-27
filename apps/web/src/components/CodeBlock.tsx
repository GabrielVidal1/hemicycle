import { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

interface CodeBlockProps {
  code: string;
  language?: string;
}

function CodeBlock({ code, language: lang = "typescript" }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const customOneDark = {
    ...oneDark,
    'pre[class*="language-"]': {
      ...oneDark['pre[class*="language-"]'],
      background: "#1A1A1A",
    },
    'code[class*="language-"]': {
      ...oneDark['code[class*="language-"]'],
      background: "#1A1A1A",
    },
  };

  return (
    <div className="relative group text-sm bg-black border border-white/20 rounded-none overflow-hidden">
      <SyntaxHighlighter
        language={lang}
        style={customOneDark}
        customStyle={{
          borderRadius: 0,
          // bg-white/10
          backgroundColor: "#1A1A1A",
          margin: 0,
          // background: "transparent",
          padding: "1rem",
        }}
      >
        {lang === "bash" ? `$ ${code.trim()}` : code}
      </SyntaxHighlighter>

      <button
        onClick={copy}
        className="absolute top-3 right-3 text-xs px-2 py-1 border border-white/20 text-white/40 hover:text-white hover:border-white/60 transition-all duration-150"
      >
        {copied ? "copied" : "copy"}
      </button>
    </div>
  );
}

export default CodeBlock;
