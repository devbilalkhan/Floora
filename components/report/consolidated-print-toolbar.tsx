"use client";

import { Printer, X } from "lucide-react";

export function ConsolidatedPrintToolbar({ projectCount }: { projectCount: number }) {
  return (
    <div className="fixed top-0 left-0 right-0 h-12 bg-zinc-800/95 backdrop-blur border-b border-zinc-700 flex items-center px-5 gap-3 z-50 print:hidden">
      <span className="text-xs font-semibold text-zinc-200">Consolidated Report</span>
      <span className="text-xs text-zinc-600">—</span>
      <span className="text-xs text-zinc-400">
        {projectCount} project{projectCount !== 1 ? "s" : ""}
      </span>
      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 text-xs bg-violet-600 text-white px-3 py-1.5 rounded-md font-medium hover:bg-violet-500 transition-colors"
        >
          <Printer className="h-3.5 w-3.5" />
          Print / Save as PDF
        </button>
        <button
          onClick={() => window.close()}
          className="flex items-center gap-1.5 text-xs text-zinc-400 border border-zinc-600 px-3 py-1.5 rounded-md hover:text-zinc-200 hover:border-zinc-500 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
          Close
        </button>
      </div>
    </div>
  );
}
