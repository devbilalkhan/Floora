"use client";

import { Printer, ArrowLeft, Download } from "lucide-react";
import { useRouter } from "next/navigation";

export function PrintControls({ backHref, pdfHref }: { backHref: string; pdfHref: string }) {
  const router = useRouter();
  return (
    <div className="print:hidden flex items-center gap-3 mb-6">
      <button
        onClick={() => router.push(backHref)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-sm bg-white hover:bg-gray-50 transition-colors text-gray-700"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Takeoff
      </button>
      <a
        href={pdfHref}
        download="takeoff.pdf"
        className="flex items-center gap-1.5 px-4 py-1.5 text-sm border border-gray-300 rounded-sm bg-white hover:bg-gray-50 transition-colors text-gray-700"
      >
        <Download className="h-3.5 w-3.5" />
        Download PDF
      </a>
      <button
        onClick={() => window.print()}
        className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-gray-900 text-white rounded-sm hover:bg-gray-700 transition-colors font-medium"
      >
        <Printer className="h-3.5 w-3.5" />
        Print / Save as PDF
      </button>
    </div>
  );
}
