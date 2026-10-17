/**
 * Copies a table as HTML (Gmail / Word paste a formatted table) plus tab-separated
 * text (Excel pastes into cells). The first column is left-aligned, the rest right-aligned.
 */
export function copyTableToClipboard(header: string[], body: string[][], foot: string[][] = []) {
  const tsv = [header, ...body, ...foot].map((row) => row.join("\t")).join("\n");
  const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const cell = (v: string, i: number, tag: "th" | "td", bold = false) =>
    `<${tag} style="border:1px solid #d0d0d0;padding:4px 8px;text-align:${i === 0 ? "left" : "right"};${bold ? "font-weight:bold;" : ""}${tag === "th" ? "background:#f2f2f2;" : ""}">${esc(v)}</${tag}>`;
  // Last footer row (the grand total) is bold
  const html =
    `<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:12px">` +
    `<tr>${header.map((v, i) => cell(v, i, "th", true)).join("")}</tr>` +
    body.map((row) => `<tr>${row.map((v, i) => cell(v, i, "td")).join("")}</tr>`).join("") +
    foot.map((row, ri) => `<tr>${row.map((v, i) => cell(v, i, "td", ri === foot.length - 1)).join("")}</tr>`).join("") +
    `</table>`;

  return typeof ClipboardItem !== "undefined"
    ? navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([tsv], { type: "text/plain" }),
        }),
      ])
    : navigator.clipboard.writeText(tsv);
}
