"use client";

import { PDFDownloadLink } from "@react-pdf/renderer";
import { FileText } from "lucide-react";
import { SWMSDocument } from "./swms-pdf";
import type { SwmsData } from "@/lib/swms-types";

interface Props {
  swms: SwmsData;
  org: {
    id: string;
    name: string;
    slug: string;
    org_code: string | null;
    abn: string | null;
    address: string | null;
    phone: string | null;
    org_email: string | null;
    logo_url: string | null;
  };
  project: { id: string; name: string; location: string | null };
  estimate: { id: string; name: string };
}

export function SWMSPdfButton({ swms, org }: Props) {
  const fileName = `${swms.document_number ?? "swms"}.pdf`;

  return (
    <PDFDownloadLink
      document={<SWMSDocument swms={swms} org={org} />}
      fileName={fileName}
    >
      {({ loading }) => (
        <button
          className="inline-flex items-center gap-1.5 text-xs border border-border rounded-lg px-3 py-1.5 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50"
          disabled={loading}
        >
          <FileText className="h-3.5 w-3.5" />
          {loading ? "Generating…" : "Export PDF"}
        </button>
      )}
    </PDFDownloadLink>
  );
}
