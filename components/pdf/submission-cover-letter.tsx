import { Document, Page, View, Text, Image, StyleSheet, type TextProps } from "@react-pdf/renderer";

type PDFStyle = TextProps["style"];

const HEADER_TOP = 24; // ~8.5mm from paper edge — breathing room above letterhead
const HEADER_H = 116; // ~41mm — accommodates logo + company name + ABN + address + contact
const FOOTER_H = 40;
const PAD_H = 52;

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#222222",
    backgroundColor: "#ffffff",
    paddingTop: HEADER_TOP + HEADER_H + 28, // paper margin + header zone + 10mm gap
    paddingBottom: FOOTER_H + 16,
    paddingHorizontal: PAD_H,
    lineHeight: 1.6,
  },

  // ── Fixed header (all pages) ──────────────────────────────────────────────
  header: {
    position: "absolute",
    top: HEADER_TOP,
    left: 0,
    right: 0,
    height: HEADER_H,
    alignItems: "center",
    justifyContent: "center",
    borderBottom: "0.0 solid #cccccc",
  },
  headerLogo: {
    width: 90,
    height: 46,
    objectFit: "contain",
    marginBottom: 8,
  },
  headerCompanyName: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.6,
    color: "#111111",
    textAlign: "center",
    marginBottom: 2,
  },
  headerMeta: {
    fontSize: 8.5,
    color: "#444444",
    textAlign: "center",
    marginBottom: 2,
    lineHeight: 1.2,
  },

  // ── Fixed footer (all pages) ──────────────────────────────────────────────
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: FOOTER_H,
    alignItems: "center",
    justifyContent: "center",
    borderTop: "0.5 solid #cccccc",
  },
  footerCompany: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.5,
    color: "#333333",
    textAlign: "center",
    marginBottom: 2,
  },
  footerAbn: {
    fontSize: 9,
    color: "#555555",
    textAlign: "center",
  },

  // ── Content ───────────────────────────────────────────────────────────────
  dateRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 20,
  },
  attnName: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginBottom: 1,
  },
  attnTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginBottom: 1,
  },
  attnCompany: {
    fontSize: 10,
    marginBottom: 18,
  },
  reBlock: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginBottom: 18,
  },
  para: {
    fontSize: 10,
    marginBottom: 10,
    lineHeight: 1.6,
  },
  heading: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    marginTop: 6,
    marginBottom: 8,
  },
  bullet: {
    flexDirection: "row",
    marginBottom: 5,
    paddingLeft: 4,
  },
  bulletDot: {
    fontSize: 10,
    marginRight: 7,
    lineHeight: 1.6,
  },
  bulletText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 1.6,
  },
  spacer: { height: 12 },
  spacerSm: { height: 6 },
  signOff: { fontSize: 10, marginBottom: 4 },
  signatoryName: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  signatoryDetail: { fontSize: 10, marginBottom: 1 },
});

// ── HTML → react-pdf renderer (bold + bullet lists) ──────────────────────────

type RichInline = { bold: boolean; text: string };
type RichBlock = { type: "p"; inlines: RichInline[] } | { type: "ul"; items: RichInline[][] };

// Collect inline runs from a DOM element, preserving bold spans.
function extractInlines(el: Element | ChildNode): RichInline[] {
  const inlines: RichInline[] = [];
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node.textContent ?? "";
      if (t) inlines.push({ bold: false, text: t });
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const child = node as Element;
      const tag = child.tagName.toLowerCase();
      if (tag === "strong" || tag === "b") {
        const t = child.textContent ?? "";
        if (t) inlines.push({ bold: true, text: t });
      } else if (tag === "br") {
        inlines.push({ bold: false, text: "\n" });
      } else {
        // span, a, div inside li, etc. — recurse without toggling bold
        inlines.push(...extractInlines(child));
      }
    }
  }
  return inlines;
}

// Use DOMParser so every browser HTML variant is handled correctly.
function parseHtml(html: string): RichBlock[] {
  if (typeof window === "undefined" || !html.trim()) return [];
  const doc = new DOMParser().parseFromString(html, "text/html");
  const blocks: RichBlock[] = [];

  for (const el of Array.from(doc.body.children)) {
    const tag = el.tagName.toLowerCase();
    if (tag === "p" || tag === "div") {
      const inlines = extractInlines(el);
      const text = inlines
        .map((i) => i.text)
        .join("")
        .trim();
      if (text) blocks.push({ type: "p", inlines });
    } else if (tag === "ul" || tag === "ol") {
      const items: RichInline[][] = [];
      for (const li of Array.from(el.querySelectorAll("li"))) {
        const inlines = extractInlines(li);
        const text = inlines
          .map((i) => i.text)
          .join("")
          .trim();
        if (text) items.push(inlines);
      }
      if (items.length) blocks.push({ type: "ul", items });
    }
  }
  return blocks;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyStyle = any;

function RichText({ inlines, style }: { inlines: RichInline[]; style: AnyStyle }) {
  const allPlain = inlines.every((i) => !i.bold);
  if (allPlain) return <Text style={style}>{inlines.map((i) => i.text).join("")}</Text>;
  return (
    <Text style={style}>
      {inlines.map((inline, idx) =>
        inline.bold ? (
          <Text key={idx} style={{ fontFamily: "Helvetica-Bold" }}>
            {inline.text}
          </Text>
        ) : (
          <Text key={idx}>{inline.text}</Text>
        ),
      )}
    </Text>
  );
}

function RichBlocks({
  html,
  paraStyle,
  bulletDotStyle,
  bulletTextStyle,
}: {
  html: string;
  paraStyle: AnyStyle;
  bulletDotStyle: AnyStyle;
  bulletTextStyle: AnyStyle;
}) {
  const blocks = parseHtml(html);
  if (!blocks.length) return null;
  return (
    <>
      {blocks.map((block, i) =>
        block.type === "p" ? (
          <RichText key={i} inlines={block.inlines} style={paraStyle} />
        ) : (
          block.items.map((inlines, j) => (
            <View
              key={`${i}-${j}`}
              style={{ flexDirection: "row", marginBottom: 5, paddingLeft: 4 } as AnyStyle}
            >
              <Text style={bulletDotStyle}>•</Text>
              <RichText inlines={inlines} style={bulletTextStyle} />
            </View>
          ))
        ),
      )}
    </>
  );
}

export type CoverLetterDocProps = {
  orgLogoUrl: string | null;
  orgName: string;
  orgAbn: string;
  orgAddress?: string;
  orgPhone?: string;
  orgEmail?: string;
  packDate: string;
  contactName: string;
  contactTitle: string;
  clientCompany: string;
  reSubject: string;
  refNotes: string;
  capabilitiesText: string;
  approachIntro: string;
  approachPoints: string[];
  closingText: string;
  signatoryName: string;
  signatoryTitle: string;
  signatoryCompany: string;
  signatoryPhone: string;
  signatoryEmail: string;
};

export function CoverLetterDoc({
  orgLogoUrl,
  orgName,
  orgAbn,
  orgAddress,
  orgPhone,
  orgEmail,
  packDate,
  contactName,
  contactTitle,
  clientCompany,
  reSubject,
  refNotes,
  capabilitiesText,
  approachIntro,
  approachPoints,
  closingText,
  signatoryName,
  signatoryTitle,
  signatoryCompany,
  signatoryPhone,
  signatoryEmail,
}: CoverLetterDocProps) {
  const dearFirst = contactName.split(" ")[0] || contactName;

  const quoteSummary =
    "We are pleased to present our comprehensive quotation for the supply and installation of the following flooring requirements.";

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Fixed header */}
        <View fixed style={s.header}>
          {orgLogoUrl && <Image src={orgLogoUrl} style={s.headerLogo} />}
          <Text style={s.headerCompanyName}>{orgName.toUpperCase()}</Text>
          {orgAbn ? <Text style={s.headerMeta}>ABN: {orgAbn}</Text> : null}
          {orgAddress ? <Text style={s.headerMeta}>{orgAddress}</Text> : null}
          {orgPhone || orgEmail ? (
            <Text style={s.headerMeta}>{[orgPhone, orgEmail].filter(Boolean).join("  ·  ")}</Text>
          ) : null}
        </View>

        {/* Fixed footer */}
        <View fixed style={s.footer}>
          <Text style={s.footerCompany}>{orgName.toUpperCase()}</Text>
          {orgAbn ? <Text style={s.footerAbn}>ABN: {orgAbn}</Text> : null}
        </View>

        {/* Date */}
        <View style={s.dateRow}>
          <Text>Date: {packDate}</Text>
        </View>

        {/* Addressee */}
        {contactName ? <Text style={s.attnName}>ATTN: {contactName}</Text> : null}
        {contactTitle ? <Text style={s.attnTitle}>{contactTitle}</Text> : null}
        {clientCompany ? (
          <Text style={s.attnCompany}>{clientCompany}</Text>
        ) : (
          <View style={s.spacer} />
        )}

        {/* Subject */}
        {reSubject ? <Text style={s.reBlock}>RE: {reSubject}</Text> : null}

        {/* Salutation */}
        <Text style={s.para}>Dear {dearFirst},</Text>

        {/* Intro */}
        <Text style={s.para}>
          We would like to acknowledge and thank you for the opportunity to submit our pricing for
          the above-mentioned project.
        </Text>

        {/* Quotation Summary section */}
        <Text style={s.heading}>Quotation Summary</Text>
        <Text style={s.para}>{quoteSummary}</Text>

        {refNotes.trim() ? <Text style={s.para}>{refNotes.trim()}</Text> : null}

        {/* Capabilities */}
        {capabilitiesText.trim() ? (
          <RichBlocks
            html={capabilitiesText}
            paraStyle={s.para}
            bulletDotStyle={s.bulletDot}
            bulletTextStyle={s.bulletText}
          />
        ) : null}

        {/* Our Approach */}
        <Text style={s.heading}>Our Approach</Text>

        {approachIntro.trim()
          ? approachIntro
              .split("\n\n")
              .filter(Boolean)
              .map((para, i) => (
                <Text key={i} style={s.para}>
                  {para.trim()}
                </Text>
              ))
          : null}

        {approachPoints
          .filter((p) => p.trim())
          .map((point, i) => (
            <View key={i} style={s.bullet}>
              <Text style={s.bulletDot}>•</Text>
              <Text style={s.bulletText}>{point.trim()}</Text>
            </View>
          ))}

        <View style={s.spacer} />

        {/* Closing */}
        {closingText.trim() ? <Text style={s.para}>{closingText.trim()}</Text> : null}

        <View style={s.spacer} />

        {/* Sign-off */}
        <Text style={s.signOff}>Yours sincerely,</Text>
        <View style={s.spacerSm} />
        <Text style={s.signOff}>Sincerely,</Text>
        <View style={{ height: 22 }} />

        {signatoryName ? (
          <Text style={s.signatoryName}>
            {signatoryName}
            {signatoryTitle ? ` | ${signatoryTitle}` : ""}
          </Text>
        ) : null}
        {signatoryCompany ? <Text style={s.signatoryDetail}>{signatoryCompany}</Text> : null}
        {signatoryPhone ? <Text style={s.signatoryDetail}>{signatoryPhone}</Text> : null}
        {signatoryEmail ? <Text style={s.signatoryDetail}>{signatoryEmail}</Text> : null}
      </Page>
    </Document>
  );
}
