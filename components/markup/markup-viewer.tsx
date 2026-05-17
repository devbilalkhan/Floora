"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, X, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";

const THUMB_W = 68; // displayed px width of each thumbnail

// ── Thumbnail (pure display — receives a pre-rendered blob URL) ────────────────

function PageThumb({
  thumbUrl,
  pageNum,
  isActive,
  onClick,
}: {
  thumbUrl: string | null;
  pageNum: number;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      data-page={pageNum}
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 w-full px-1.5 py-1.5 rounded-sm transition-colors",
        isActive ? "bg-primary/15" : "hover:bg-white/[0.05]"
      )}
    >
      <div
        className={cn(
          "rounded-[2px] overflow-hidden border shadow-md shadow-black/40 transition-colors",
          isActive ? "border-primary/60" : "border-white/[0.08]"
        )}
        style={{ width: THUMB_W }}
      >
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt={`Page ${pageNum}`}
            style={{ width: THUMB_W, display: "block" }}
            draggable={false}
          />
        ) : (
          // Skeleton — A4 aspect ratio ≈ 1 : 1.414
          <div
            className="bg-muted/20 animate-pulse"
            style={{ width: THUMB_W, height: Math.round(THUMB_W / 1.414) }}
          />
        )}
      </div>
      <span
        className={cn(
          "text-[9px] tabular-nums leading-none select-none",
          isActive ? "text-primary" : "text-muted-foreground/40"
        )}
      >
        {pageNum}
      </span>
    </button>
  );
}

// ── Viewer ─────────────────────────────────────────────────────────────────────

interface Props {
  url: string;
  fileName: string;
  onClose?: () => void;
}

export function MarkupViewer({ url, fileName, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const thumbStripRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfRef = useRef<any>(null);
  const renderVersion = useRef(0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pdf, setPdf] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [thumbUrls, setThumbUrls] = useState<(string | null)[]>([]);
  const dragStart = useRef({ mouseX: 0, mouseY: 0, panX: 0, panY: 0 });
  const thumbBlobsRef = useRef<string[]>([]);

  // Load PDF
  useEffect(() => {
    let cancelled = false;
    setCurrentPage(1);
    setTotalPages(0);
    setScale(1.0);
    setPan({ x: 0, y: 0 });
    setPdf(null);
    setThumbUrls([]);
    thumbBlobsRef.current.forEach(u => URL.revokeObjectURL(u));
    thumbBlobsRef.current = [];

    async function load() {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      const doc = await pdfjs.getDocument(url).promise;
      if (cancelled) return;
      pdfRef.current = doc;
      setPdf(doc);
      setTotalPages(doc.numPages);
    }

    load();
    return () => { cancelled = true; };
  }, [url]);

  // Render thumbnails sequentially after a delay so the main page renders first
  useEffect(() => {
    if (!pdf || totalPages <= 1) return;

    setThumbUrls(new Array(totalPages).fill(null));

    let cancelled = false;

    async function renderThumbs() {
      for (let i = 1; i <= totalPages; i++) {
        if (cancelled) break;
        try {
          const page = await pdf.getPage(i);
          if (cancelled) break;

          const nativeVp = page.getViewport({ scale: 1 });
          const dpr = window.devicePixelRatio || 1;
          const thumbScale = (THUMB_W / nativeVp.width) * dpr;
          const vp = page.getViewport({ scale: thumbScale });

          const offscreen = document.createElement("canvas");
          offscreen.width = vp.width;
          offscreen.height = vp.height;
          const ctx = offscreen.getContext("2d");
          if (!ctx) continue;

          await page.render({ canvasContext: ctx, viewport: vp }).promise;
          if (cancelled) break;

          const blob = await new Promise<Blob | null>(res =>
            offscreen.toBlob(res, "image/jpeg", 0.82)
          );
          if (!blob || cancelled) break;

          const blobUrl = URL.createObjectURL(blob);
          thumbBlobsRef.current.push(blobUrl);

          setThumbUrls(prev => {
            const next = [...prev];
            next[i - 1] = blobUrl;
            return next;
          });
        } catch {
          // page render failed — leave skeleton in place
        }
      }
    }

    // Short delay so the main page render completes first
    const timer = setTimeout(renderThumbs, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pdf, totalPages]);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      thumbBlobsRef.current.forEach(u => URL.revokeObjectURL(u));
    };
  }, []);

  // Render main canvas
  const renderPage = useCallback(async (pageNum: number, pageScale: number) => {
    const doc = pdfRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas) return;

    const version = ++renderVersion.current;
    try {
      const page = await doc.getPage(pageNum);
      if (version !== renderVersion.current) return;

      const dpr = window.devicePixelRatio || 1;
      const vp = page.getViewport({ scale: pageScale * dpr });
      canvas.width = vp.width;
      canvas.height = vp.height;
      canvas.style.width = `${vp.width / dpr}px`;
      canvas.style.height = `${vp.height / dpr}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
    } catch {
      // superseded or cancelled
    }
  }, []);

  useEffect(() => {
    if (totalPages > 0) renderPage(currentPage, scale);
  }, [currentPage, scale, totalPages, renderPage]);

  // Auto-scroll strip to keep active thumb visible
  useEffect(() => {
    const strip = thumbStripRef.current;
    if (!strip) return;
    const active = strip.querySelector(`[data-page="${currentPage}"]`);
    active?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [currentPage]);

  async function fitToWidth() {
    const doc = pdfRef.current;
    const container = containerRef.current;
    if (!doc || !container) return;
    const page = await doc.getPage(currentPage);
    const vp = page.getViewport({ scale: 1 });
    const availWidth = container.clientWidth - 40;
    const computed = Math.min(Math.max(availWidth / vp.width, 0.25), 3.0);
    setScale(computed);
    setPan({ x: 0, y: 0 });
  }

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.target as HTMLElement).isContentEditable) return;

      switch (e.key) {
        case "=": case "+":
          e.preventDefault();
          setScale(s => Math.min(parseFloat((s + 0.2).toFixed(2)), 5));
          break;
        case "-":
          e.preventDefault();
          setScale(s => Math.max(parseFloat((s - 0.2).toFixed(2)), 0.2));
          break;
        case "0":
          e.preventDefault();
          setScale(1.0);
          setPan({ x: 0, y: 0 });
          break;
        case "ArrowLeft": case "PageUp":
          e.preventDefault();
          setCurrentPage(p => Math.max(p - 1, 1));
          setPan({ x: 0, y: 0 });
          break;
        case "ArrowRight": case "PageDown":
          e.preventDefault();
          setCurrentPage(p => Math.min(p + 1, totalPages));
          setPan({ x: 0, y: 0 });
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [totalPages]);

  // Ctrl+scroll / trackpad pinch → zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.1 : -0.1;
        setScale(s => Math.min(Math.max(parseFloat((s + delta).toFixed(2)), 0.2), 5));
      }
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  function onMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { mouseX: e.clientX, mouseY: e.clientY, panX: pan.x, panY: pan.y };
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!isDragging) return;
    setPan({
      x: dragStart.current.panX + (e.clientX - dragStart.current.mouseX),
      y: dragStart.current.panY + (e.clientY - dragStart.current.mouseY),
    });
  }
  function onMouseUp() { setIsDragging(false); }

  const btn = cn(
    "flex items-center justify-center h-6 w-6 rounded-sm transition-colors",
    "text-muted-foreground hover:text-foreground hover:bg-white/[0.06]",
    "disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none"
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 h-9 border-b border-white/[0.06] bg-muted/20 shrink-0">
        <span className="text-xs text-foreground/50 truncate flex-1 min-w-0 select-none">{fileName}</span>
        <div className="flex items-center gap-0.5 shrink-0">
          <button className={btn} onClick={() => { setCurrentPage(p => Math.max(p - 1, 1)); setPan({ x: 0, y: 0 }); }} disabled={currentPage <= 1} title="Previous page (←)">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="text-xs tabular-nums text-muted-foreground w-14 text-center select-none">
            {totalPages ? `${currentPage} / ${totalPages}` : "—"}
          </span>
          <button className={btn} onClick={() => { setCurrentPage(p => Math.min(p + 1, totalPages)); setPan({ x: 0, y: 0 }); }} disabled={currentPage >= totalPages} title="Next page (→)">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <div className="w-px h-4 bg-white/10 mx-1" />
          <button className={btn} onClick={() => setScale(s => Math.max(parseFloat((s - 0.2).toFixed(2)), 0.2))} title="Zoom out (-)">
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="text-xs tabular-nums text-muted-foreground w-10 text-center select-none">
            {Math.round(scale * 100)}%
          </span>
          <button className={btn} onClick={() => setScale(s => Math.min(parseFloat((s + 0.2).toFixed(2)), 5))} title="Zoom in (+)">
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button className={btn} onClick={fitToWidth} title="Fit to width">
            <Maximize2 className="h-3 w-3" />
          </button>
          {onClose && (
            <>
              <div className="w-px h-4 bg-white/10 mx-1" />
              <button className={btn} onClick={onClose} title="Close">
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Body: thumbnail strip + canvas */}
      <div className="flex-1 overflow-hidden flex min-h-0">

        {/* Thumbnail strip — multi-page only */}
        {totalPages > 1 && (
          <div
            ref={thumbStripRef}
            className="w-[88px] shrink-0 border-r border-white/[0.06] overflow-y-auto bg-[hsl(240_22%_5.5%)] py-2 space-y-0.5"
            style={{ scrollbarWidth: "none" }}
          >
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
              <PageThumb
                key={pageNum}
                thumbUrl={thumbUrls[pageNum - 1] ?? null}
                pageNum={pageNum}
                isActive={currentPage === pageNum}
                onClick={() => { setCurrentPage(pageNum); setPan({ x: 0, y: 0 }); }}
              />
            ))}
          </div>
        )}

        {/* Main canvas */}
        <div
          ref={containerRef}
          className="flex-1 overflow-hidden relative select-none"
          style={{ cursor: isDragging ? "grabbing" : "grab", background: "hsl(240 22% 6%)" }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          {totalPages === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-5 w-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            </div>
          )}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: 24,
              transform: `translateX(calc(-50% + ${pan.x}px)) translateY(${pan.y}px)`,
            }}
          >
            <canvas ref={canvasRef} className="rounded shadow-2xl shadow-black/70" style={{ display: "block" }} />
          </div>
        </div>
      </div>

      {/* Hint bar */}
      <div className="px-3 h-6 border-t border-white/[0.04] flex items-center shrink-0">
        <span className="text-[10px] text-muted-foreground/35 select-none">
          +/− zoom · ←/→ pages · drag to pan · 0 reset · Ctrl+scroll zoom
        </span>
      </div>
    </div>
  );
}
