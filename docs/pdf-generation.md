# Print PDF Generation Spec
**Version:** 1.0  
**Purpose:** Reusable spec for any app that generates print-quality PDFs with preview

---

## 1. Page Layout & Margins

All pages — including continuation pages — must have identical margins.

| Side | Minimum | Recommended |
|------|---------|-------------|
| Top | 20mm | 25mm |
| Bottom | 20mm | 25mm |
| Left | 15mm | 20mm |
| Right | 15mm | 20mm |

**Critical rule:** Never let content start at Y=0 on any page. Page 2+ must apply the same top margin as page 1.

### By Library

**Puppeteer / Playwright (HTML → PDF)**
```css
@page {
  margin: 25mm 20mm;
  size: A4;
}

/* Ensure first page has same margin as all others */
@page :first {
  margin: 25mm 20mm;
}
```

**pdfmake**
```javascript
const docDefinition = {
  pageMargins: [40, 60, 40, 60], // [left, top, right, bottom] in points
};
```

**jsPDF**
```javascript
const doc = new jsPDF({ unit: 'mm', format: 'a4' });
const margin = { top: 25, bottom: 25, left: 20, right: 20 };
// Apply margin.top as Y offset when adding content on each new page
```

**WeasyPrint / ReportLab**
```python
# WeasyPrint — use CSS @page rule (same as Puppeteer above)
# ReportLab
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
margin = 20 * mm
```

---

## 2. Header — Repeating on Every Page

The document header must appear at the top of **every page**, not just page 1.

### What belongs in the header
- Company logo (left-aligned)
- Company name and contact details (right-aligned or beside logo)
- Optional: document title or quote/invoice number
- A horizontal rule or border below the header to separate it from body content

### By Library

**Puppeteer / Playwright**

Pass `headerTemplate` to `page.pdf()` — this renders on every page automatically:
```javascript
await page.pdf({
  format: 'A4',
  margin: { top: '30mm', bottom: '25mm', left: '20mm', right: '20mm' },
  displayHeaderFooter: true,
  headerTemplate: `
    <div style="width:100%; font-size:9px; padding: 0 20mm; box-sizing:border-box;
                display:flex; justify-content:space-between; align-items:center;
                border-bottom: 1px solid #ccc; padding-bottom: 6px;">
      <div><img src="data:image/png;base64,..." style="height:32px;" /></div>
      <div style="text-align:right;">
        <strong>Company Name</strong><br/>
        phone · email
      </div>
    </div>`,
  footerTemplate: `<div></div>`, // required even if empty
  printBackground: true,
});
```

> ⚠️ Images in Puppeteer headers **must** be base64-encoded — external URLs won't load.

**pdfmake**
```javascript
const docDefinition = {
  header: function(currentPage, pageCount) {
    return {
      columns: [
        { image: 'logo', width: 60 },
        { text: 'Company Name\nphone · email', alignment: 'right', fontSize: 9 }
      ],
      margin: [40, 15, 40, 0],
    };
  },
  images: {
    logo: 'data:image/png;base64,...'
  }
};
```

**jsPDF + jsPDF-AutoTable**
```javascript
function addHeader(doc) {
  doc.addImage(logoBase64, 'PNG', 20, 10, 40, 15);
  doc.setFontSize(9);
  doc.text('Company Name', 190, 14, { align: 'right' });
  doc.text('phone · email', 190, 19, { align: 'right' });
  doc.setDrawColor(200);
  doc.line(20, 26, 190, 26); // horizontal rule
}

// Call addHeader on every page
doc.addPage();
addHeader(doc);
```

---

## 3. Footer — Repeating on Every Page

Footers should include at minimum:
- Company name + contact (or tagline)
- Page number and total pages (e.g. "Page 1 of 3")
- A horizontal rule or top border to separate from body content

### By Library

**Puppeteer / Playwright**
```javascript
footerTemplate: `
  <div style="width:100%; font-size:8px; padding: 4px 20mm 0; box-sizing:border-box;
              display:flex; justify-content:space-between; border-top: 1px solid #ccc;">
    <span>Company Name · email · phone</span>
    <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
  </div>`
```

**pdfmake**
```javascript
footer: function(currentPage, pageCount) {
  return {
    columns: [
      { text: 'Company Name · email · phone', fontSize: 8, color: '#666' },
      { text: `Page ${currentPage} of ${pageCount}`, alignment: 'right', fontSize: 8 }
    ],
    margin: [40, 0, 40, 15],
  };
}
```

---

## 4. User Flow — Print Preview Before Download

Never trigger an immediate file download. Always show a preview step first.

### Required Flow
```
[Generate / Preview button]
        ↓
[PDF generated into memory as Blob or base64]
        ↓
[Preview modal opens — PDF rendered in <iframe>]
        ↓
[User clicks "Download PDF"] → file saved to disk
[User clicks "Close"] → modal dismissed, no download
```

### Implementation

**Step 1 — Generate into memory, not a file**

```javascript
// Puppeteer — return buffer, not save to disk
const pdfBuffer = await page.pdf({ format: 'A4', ... });
const base64 = pdfBuffer.toString('base64');
// Send base64 to frontend

// pdfmake — get data URL
pdfMake.createPdf(docDefinition).getDataUrl((dataUrl) => {
  openPreviewModal(dataUrl);
});

// jsPDF — get blob URL
const blobUrl = doc.output('bloburl');
openPreviewModal(blobUrl);
```

**Step 2 — Preview modal (React example)**
```jsx
function PdfPreviewModal({ pdfUrl, fileName, onClose }) {
  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = pdfUrl;
    a.download = fileName;
    a.click();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Preview — {fileName}</h2>
          <div className="modal-actions">
            <button onClick={handleDownload}>⬇ Download PDF</button>
            <button onClick={onClose}>✕ Close</button>
          </div>
        </div>
        <iframe
          src={pdfUrl}
          width="100%"
          height="80vh"
          style={{ border: 'none' }}
          title="PDF Preview"
        />
      </div>
    </div>
  );
}
```

**Step 3 — Trigger from button**
```jsx
<button onClick={() => generatePdfAndPreview()}>
  Preview & Download
</button>
```

---

## 5. Content Layout Rules

### Avoid page breaks splitting content

**Puppeteer / HTML**
```css
.line-item-row { page-break-inside: avoid; }
.section-block  { page-break-inside: avoid; }
h2, h3          { page-break-after: avoid; }
```

**pdfmake**
```javascript
{ text: 'Section heading', pageBreak: 'before' } // force break before if needed
{ stack: [...], unbreakable: true }               // keep block together
```

### Tables
- Header rows must repeat on every page (`repeatTableHeaders: true` in pdfmake, `thead` in HTML/CSS)
- Last column should never be cut off — always confirm table fits within content width
- Minimum row height: 8mm for readability

### Typography
| Element | Size | Weight |
|---------|------|--------|
| Body text | 10–11pt | Regular |
| Table content | 9–10pt | Regular |
| Section headings | 12–14pt | Bold |
| Footer / caption | 8–9pt | Regular |
| Header company name | 10–11pt | Bold |

---

## 6. Images in PDFs

- Always use **base64-encoded** images, not external URLs (external URLs often fail in PDF renderers)
- Logo: embed once, reuse across header instances
- Target resolution: 150–200 DPI for print quality
- Avoid using `<img>` tags with `src` pointing to a server when using Puppeteer — the renderer may not have network access

---

## 7. Checklist Before Shipping

Run through this before considering PDF generation complete:

- [ ] Page 1 and page 2+ have identical top margins
- [ ] Header appears on every page (not just page 1)
- [ ] Footer appears on every page with correct page numbers
- [ ] No content touches the page edge (all within margins)
- [ ] Table rows do not split awkwardly across pages
- [ ] Table headers repeat on continuation pages
- [ ] Preview modal opens before any file download
- [ ] Download only triggers on explicit user action
- [ ] Logo and images are base64 or confirmed accessible by renderer
- [ ] PDF tested at minimum 2 pages of content to verify pagination behaviour
- [ ] Tested on both Chrome and Safari (Puppeteer) or equivalent

---

## 8. Quick Prompt Templates for Claude Code

### Fix margins on continuation pages
> Page 1 renders correctly but page 2+ starts content at the very top with no margin. Fix this so all pages apply the same top margin (`[X]mm`) as page 1. Check the `@page` CSS rule or `pageMargins` config and ensure it applies globally, not just to the first page.

### Add repeating header
> The header currently only appears on page 1. Make it repeat on every page. Use `headerTemplate` (Puppeteer), the `header` function (pdfmake), or a per-page `addHeader()` call (jsPDF). The header should include the company logo (base64), company name, and contact details, with a horizontal rule beneath it.

### Add print preview step
> Instead of downloading the PDF immediately, generate it into memory first (as a Blob URL or base64 data URL), display it in a full-screen preview modal with an `<iframe>`, and only trigger the file download when the user clicks a "Download PDF" button inside the modal. Add a "Close" button to dismiss without downloading.

### Keep table rows together
> Some table rows are being split across pages. Add `page-break-inside: avoid` to row elements (HTML/CSS), or set `unbreakable: true` on row stacks (pdfmake), so rows always stay on one page. Also ensure the table header row repeats on every page.