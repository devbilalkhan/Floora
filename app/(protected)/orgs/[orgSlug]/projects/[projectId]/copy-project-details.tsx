"use client";

import { useState } from "react";
import { Clipboard, Check } from "lucide-react";

interface Props {
  name: string;
  location?: string | null;
  headClient?: string | null;
}

export function CopyProjectDetails({ name, location, headClient }: Props) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    const lines = [`Project Name: ${name}`];
    if (location) lines.push(`Address: ${location}`);
    if (headClient) lines.push(`Specifier: ${headClient}`);

    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      onClick={handleCopy}
      title="Copy project details"
      className="flex items-center justify-center h-5 w-5 rounded text-muted-foreground/50 hover:text-muted-foreground transition-colors"
    >
      {copied
        ? <Check className="h-3.5 w-3.5 text-emerald-400" />
        : <Clipboard className="h-3.5 w-3.5" />
      }
    </button>
  );
}
