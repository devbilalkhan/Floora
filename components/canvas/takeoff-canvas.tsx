"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  Stage,
  Layer,
  Image as KonvaImage,
  Circle as KonvaCircle,
  Line as KonvaLine,
  Text as KonvaText,
} from "react-konva";
import Konva from "konva";
import {
  ChevronRight,
  ChevronLeft,
  ZoomIn,
  ZoomOut,
  Maximize2,
  MousePointer2,
  Ruler,
  PenLine,
  Hash,
  Hand,
  Loader2,
  AlertTriangle,
  Check,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { SCOPE_CATEGORIES, SCOPE_COLOURS } from "@/lib/tokens";
import type { ScopeCategory } from "@/lib/tokens";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────────

type Tool = "select" | "pan" | "calibrate" | "area" | "linear" | "count";
type CalibrateStep = "awaiting_A" | "awaiting_B" | "distance_dialog" | "ratio_dialog" | null;

interface PageData {
  id: string;
  page_number: number;
  scale_factor: number | null;
  scale_calibrated_at: string | null;
}

interface TakeoffItem {
  id: string;
  drawing_page_id: string;
  type: "area" | "linear" | "count";
  label: string;
  scope_category: string;
  color: string;
  geometry: { points: [number, number][] };
  computed_value: number;
  unit: "m2" | "lm" | "count";
  locked: boolean;
}

interface Props {
  drawingId: string;
  drawingName: string;
  mimeType: string;
  pageCount: number;
  signedUrl: string;
  projectId: string;
  projectName: string;
  initialPages: PageData[];
}

// ── Constants ──────────────────────────────────────────────────────────────────

const ZOOM_STEP = 0.1;
const ZOOM_MIN = 0.05;
const ZOOM_MAX = 8;
const RENDER_SCALE = 2;

const PAPER_SIZES: Record<string, { w: number; h: number }> = {
  A0: { w: 1.189, h: 0.841 },
  A1: { w: 0.841, h: 0.594 },
  A2: { w: 0.594, h: 0.420 },
  A3: { w: 0.420, h: 0.297 },
  A4: { w: 0.297, h: 0.210 },
};

const RATIO_PRESETS = ["20", "50", "100", "200", "500", "1000"];

// ── Pure helpers ───────────────────────────────────────────────────────────────

function hexWithOpacity(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function computePolygonArea(pts: { x: number; y: number }[], sf: number): number {
  const n = pts.length;
  if (n < 3) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    sum += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return (Math.abs(sum) / 2) * sf * sf;
}

function ccw(A: [number, number], B: [number, number], C: [number, number]): boolean {
  return (C[1] - A[1]) * (B[0] - A[0]) > (B[1] - A[1]) * (C[0] - A[0]);
}

function segmentsIntersect(
  p1: [number, number], p2: [number, number],
  p3: [number, number], p4: [number, number]
): boolean {
  return (
    ccw(p1, p3, p4) !== ccw(p2, p3, p4) &&
    ccw(p1, p2, p3) !== ccw(p1, p2, p4)
  );
}

function isPolygonSelfIntersecting(pts: { x: number; y: number }[]): boolean {
  const n = pts.length;
  if (n < 4) return false;
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const p1: [number, number] = [pts[i].x, pts[i].y];
      const p2: [number, number] = [pts[i + 1].x, pts[i + 1].y];
      const p3: [number, number] = [pts[j].x, pts[j].y];
      const p4: [number, number] = [pts[(j + 1) % n].x, pts[(j + 1) % n].y];
      if (segmentsIntersect(p1, p2, p3, p4)) return true;
    }
  }
  return false;
}

// ── PDF loader ─────────────────────────────────────────────────────────────────

async function renderPdfPage(url: string, pageNum: number): Promise<HTMLCanvasElement> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const pdf = await pdfjsLib.getDocument(url).promise;
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale: RENDER_SCALE });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
  return canvas;
}

async function loadImagePage(url: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d")!.drawImage(img, 0, 0);
      resolve(canvas);
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function TakeoffCanvas({
  drawingName,
  mimeType,
  pageCount,
  signedUrl,
  projectId,
  projectName,
  initialPages,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);

  // ── Canvas state ───────────────────────────────────────────────────────────

  const [tool, setTool] = useState<Tool>("select");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageCanvas, setPageCanvas] = useState<HTMLCanvasElement | null>(null);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [containerSize, setContainerSize] = useState({ w: 800, h: 600 });
  const [zoom, setZoom] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [spaceDown, setSpaceDown] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // ── Pages + scale ──────────────────────────────────────────────────────────

  const [pages, setPages] = useState<PageData[]>(initialPages);
  const currentPageData = pages.find((p) => p.page_number === currentPage) ?? null;
  const scaleFactor = currentPageData?.scale_factor ?? null;

  const scaleFactorRef = useRef(scaleFactor);
  scaleFactorRef.current = scaleFactor;

  // ── Calibration state ──────────────────────────────────────────────────────

  const [calibrateStep, setCalibrateStep] = useState<CalibrateStep>(null);
  const [calibratePoints, setCalibratePoints] = useState<{ x: number; y: number }[]>([]);
  const [showFirstTimeModal, setShowFirstTimeModal] = useState(false);
  const [showRecalibrateConfirm, setShowRecalibrateConfirm] = useState(false);
  const [isSavingScale, setIsSavingScale] = useState(false);
  const [distanceInput, setDistanceInput] = useState("");
  const [distanceUnit, setDistanceUnit] = useState<"m" | "mm">("m");
  const [ratioScale, setRatioScale] = useState("100");
  const [ratioCustom, setRatioCustom] = useState("");
  const [ratioPaperSize, setRatioPaperSize] = useState("A1");

  const calibrateStepRef = useRef<CalibrateStep>(null);
  calibrateStepRef.current = calibrateStep;

  // ── Takeoff items ──────────────────────────────────────────────────────────

  const [takeoffItems, setTakeoffItems] = useState<TakeoffItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const takeoffItemsRef = useRef<TakeoffItem[]>([]);
  takeoffItemsRef.current = takeoffItems;
  const selectedItemIdRef = useRef<string | null>(null);
  selectedItemIdRef.current = selectedItemId;
  const isSavingItemRef = useRef(false);

  // ── In-progress area drawing ───────────────────────────────────────────────

  const [areaPoints, setAreaPoints] = useState<{ x: number; y: number }[]>([]);
  const [isSelfIntersecting, setIsSelfIntersecting] = useState(false);
  const areaPointsRef = useRef<{ x: number; y: number }[]>([]);

  // ── Tool form state ────────────────────────────────────────────────────────

  const [itemLabel, setItemLabel] = useState("");
  const [itemScope, setItemScope] = useState<ScopeCategory>("vinyl");
  const [itemColour, setItemColour] = useState(SCOPE_COLOURS.vinyl);
  const [showLabelWarning, setShowLabelWarning] = useState(false);

  const isPdf = mimeType === "application/pdf";
  const showToolOptions = tool === "area" || tool === "linear" || tool === "count";

  // ── Container resize observer ──────────────────────────────────────────────

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setContainerSize({ w: Math.floor(width), h: Math.floor(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Page load ─────────────────────────────────────────────────────────────

  useEffect(() => {
    setIsLoading(true);
    setPageCanvas(null);
    if (!signedUrl) { setIsLoading(false); return; }
    const load = isPdf ? renderPdfPage(signedUrl, currentPage) : loadImagePage(signedUrl);
    load
      .then((canvas) => { setPageCanvas(canvas); setImgSize({ w: canvas.width, h: canvas.height }); setIsLoading(false); })
      .catch(() => setIsLoading(false));
  }, [isPdf, signedUrl, currentPage]);

  // ── Load takeoff items when page changes ───────────────────────────────────

  useEffect(() => {
    if (!currentPageData) { setTakeoffItems([]); return; }
    const supabase = createClient();
    supabase
      .from("takeoff_items")
      .select("id, drawing_page_id, type, label, scope_category, color, geometry, computed_value, unit, locked")
      .eq("drawing_page_id", currentPageData.id)
      .then(({ data }) => setTakeoffItems((data as TakeoffItem[]) ?? []));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPageData?.id]);

  // ── Reset on page / tool change ────────────────────────────────────────────

  useEffect(() => {
    setCalibrateStep(null);
    setCalibratePoints([]);
    setAreaPoints([]);
    areaPointsRef.current = [];
    setSelectedItemId(null);
    setTool("select");
  }, [currentPage]);

  useEffect(() => {
    setAreaPoints([]);
    areaPointsRef.current = [];
    setIsSelfIntersecting(false);
  }, [tool]);

  // ── First-time modal ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!isLoading) setShowFirstTimeModal(scaleFactor === null);
  }, [isLoading, scaleFactor]);

  // ── Fit to screen ──────────────────────────────────────────────────────────

  const fitToScreen = useCallback(() => {
    if (!imgSize.w || !imgSize.h || !containerSize.w || !containerSize.h) return;
    const scaleX = containerSize.w / (imgSize.w / RENDER_SCALE);
    const scaleY = containerSize.h / (imgSize.h / RENDER_SCALE);
    const fit = Math.min(scaleX, scaleY) * 0.92;
    const dispW = (imgSize.w / RENDER_SCALE) * fit;
    const dispH = (imgSize.h / RENDER_SCALE) * fit;
    setZoom(fit);
    setStagePos({ x: (containerSize.w - dispW) / 2, y: (containerSize.h - dispH) / 2 });
  }, [imgSize, containerSize]);

  useEffect(() => { if (!isLoading) fitToScreen(); }, [isLoading, fitToScreen]);

  // ── Keyboard handler ───────────────────────────────────────────────────────

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === "Space") { e.preventDefault(); setSpaceDown(true); }

      if (e.key === "Escape") {
        if (areaPointsRef.current.length > 0) {
          setAreaPoints([]); areaPointsRef.current = []; setIsSelfIntersecting(false);
        } else if (calibrateStepRef.current) {
          setCalibrateStep(null); setCalibratePoints([]); setTool("select");
        }
        return;
      }

      if (e.key === "Enter" && areaPointsRef.current.length >= 3) {
        const pts = [...areaPointsRef.current];
        closeAreaPolygon(pts);
        return;
      }

      if ((e.key === "Delete" || e.key === "Backspace") && selectedItemIdRef.current) {
        e.preventDefault();
        setPendingDeleteId(selectedItemIdRef.current);
        return;
      }

      switch (e.key.toLowerCase()) {
        case "v": setTool("select"); break;
        case "h": setTool("pan"); break;
        case "c":
          if (scaleFactorRef.current !== null) setShowRecalibrateConfirm(true);
          else setShowFirstTimeModal(true);
          break;
        case "a": if (scaleFactorRef.current !== null) setTool("area"); break;
        case "l": if (scaleFactorRef.current !== null) setTool("linear"); break;
        case "p": if (scaleFactorRef.current !== null) setTool("count"); break;
        case "z":
          if (e.shiftKey) fitToScreen();
          else if (!(e.ctrlKey || e.metaKey)) applyZoom(ZOOM_STEP);
          break;
        case "=": case "+": applyZoom(ZOOM_STEP); break;
        case "-": applyZoom(-ZOOM_STEP); break;
      }
    }
    function onKeyUp(e: KeyboardEvent) { if (e.code === "Space") setSpaceDown(false); }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => { window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitToScreen]);

  // ── Zoom helpers ──────────────────────────────────────────────────────────

  function applyZoom(delta: number) {
    setZoom((z) => {
      const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z + delta));
      const cx = containerSize.w / 2;
      const cy = containerSize.h / 2;
      setStagePos((pos) => ({ x: cx - (cx - pos.x) * (next / z), y: cy - (cy - pos.y) * (next / z) }));
      return next;
    });
  }

  function handleWheel(e: Konva.KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const direction = e.evt.deltaY < 0 ? 1 : -1;
    const factor = 1 + direction * 0.08;
    const newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom * factor));
    setZoom(newZoom);
    setStagePos({ x: pointer.x - (pointer.x - stagePos.x) * (newZoom / zoom), y: pointer.y - (pointer.y - stagePos.y) * (newZoom / zoom) });
  }

  // ── Mouse helpers ──────────────────────────────────────────────────────────

  function getPagePos(): { x: number; y: number } | null {
    const stage = stageRef.current;
    if (!stage) return null;
    const pos = stage.getPointerPosition();
    if (!pos) return null;
    return { x: (pos.x - stagePos.x) / zoom, y: (pos.y - stagePos.y) / zoom };
  }

  function handleMouseMove(_e: Konva.KonvaEventObject<MouseEvent>) {
    const p = getPagePos();
    if (p) setCursorPos(p);
  }

  // ── Stage click ────────────────────────────────────────────────────────────

  function handleStageClick(e: Konva.KonvaEventObject<MouseEvent>) {
    if (e.evt.button !== 0) return;

    // Calibrate tool
    const step = calibrateStepRef.current;
    if (tool === "calibrate" && step && step !== "distance_dialog" && step !== "ratio_dialog") {
      const p = getPagePos();
      if (!p) return;
      if (step === "awaiting_A") {
        setCalibratePoints([p]);
        setCalibrateStep("awaiting_B");
      } else if (step === "awaiting_B") {
        setCalibratePoints((prev) => [...prev, p]);
        setCalibrateStep("distance_dialog");
      }
      return;
    }

    // Area tool
    if (tool === "area") {
      if (!itemLabel.trim()) {
        setShowLabelWarning(true);
        setTimeout(() => setShowLabelWarning(false), 2000);
        return;
      }
      const p = getPagePos();
      if (!p) return;
      const newPts = [...areaPointsRef.current, p];
      areaPointsRef.current = newPts;
      setAreaPoints(newPts);
      setIsSelfIntersecting(isPolygonSelfIntersecting(newPts));
      return;
    }

    // Select tool — clicking empty canvas deselects
    if (tool === "select") {
      setSelectedItemId(null);
    }
  }

  // Double-click closes the polygon (Konva fires 2 clicks before dblclick)
  function handleStageDblClick(_e: Konva.KonvaEventObject<MouseEvent>) {
    if (tool !== "area") return;
    const ptsWithoutLast = areaPointsRef.current.slice(0, -1);
    if (ptsWithoutLast.length >= 3) {
      closeAreaPolygon(ptsWithoutLast);
    }
  }

  // ── Area polygon close + save ──────────────────────────────────────────────

  async function closeAreaPolygon(pts: { x: number; y: number }[]) {
    if (isSavingItemRef.current || pts.length < 3) return;
    if (isPolygonSelfIntersecting(pts)) return;
    if (!scaleFactor || !currentPageData) return;

    isSavingItemRef.current = true;
    // Clear optimistically so the canvas feels responsive
    setAreaPoints([]);
    areaPointsRef.current = [];
    setIsSelfIntersecting(false);

    const computedValue = computePolygonArea(pts, scaleFactor);
    const geometry = { points: pts.map((p) => [p.x, p.y] as [number, number]) };

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      isSavingItemRef.current = false;
      toast.error("Not signed in — could not save.");
      return;
    }

    const { data: newItem, error } = await supabase
      .from("takeoff_items")
      .insert({
        drawing_page_id: currentPageData.id,
        owner_id: user.id,
        type: "area",
        label: itemLabel.trim(),
        scope_category: itemScope,
        color: itemColour,
        geometry,
        computed_value: computedValue,
        unit: "m2",
      })
      .select("id, drawing_page_id, type, label, scope_category, color, geometry, computed_value, unit, locked")
      .single();

    if (error || !newItem) {
      // Restore the polygon so the user doesn't lose their work
      setAreaPoints(pts);
      areaPointsRef.current = pts;
      toast.error(`Could not save: ${error?.message ?? "unknown error"}. Check Supabase migration 003 has been run.`);
    } else {
      setTakeoffItems((prev) => [...prev, newItem as TakeoffItem]);
    }
    isSavingItemRef.current = false;
  }

  // ── Vertex editing ─────────────────────────────────────────────────────────

  function handleVertexDragMove(itemId: string, idx: number, e: Konva.KonvaEventObject<DragEvent>) {
    const nx = e.target.x();
    const ny = e.target.y();
    const items = takeoffItemsRef.current;
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    const newPoints = [...item.geometry.points] as [number, number][];
    newPoints[idx] = [nx, ny];
    const updated: TakeoffItem = {
      ...item,
      geometry: { points: newPoints },
      computed_value: scaleFactor
        ? computePolygonArea(newPoints.map(([x, y]) => ({ x, y })), scaleFactor)
        : item.computed_value,
    };
    takeoffItemsRef.current = items.map((i) => (i.id === itemId ? updated : i));
    setTakeoffItems([...takeoffItemsRef.current]);
  }

  function handleVertexDragEnd(itemId: string) {
    const item = takeoffItemsRef.current.find((i) => i.id === itemId);
    if (!item) return;
    const supabase = createClient();
    supabase
      .from("takeoff_items")
      .update({ geometry: item.geometry, computed_value: item.computed_value })
      .eq("id", itemId);
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  async function confirmDelete() {
    if (!pendingDeleteId) return;
    const supabase = createClient();
    await supabase.from("takeoff_items").delete().eq("id", pendingDeleteId);
    setTakeoffItems((prev) => prev.filter((i) => i.id !== pendingDeleteId));
    if (selectedItemId === pendingDeleteId) setSelectedItemId(null);
    setPendingDeleteId(null);
  }

  // ── Calibration save ───────────────────────────────────────────────────────

  async function saveScaleFactor(sf: number) {
    if (!currentPageData) return;
    setIsSavingScale(true);
    const calibratedAt = new Date().toISOString();
    const supabase = createClient();
    const { error } = await supabase
      .from("drawing_pages")
      .update({ scale_factor: sf, scale_calibrated_at: calibratedAt })
      .eq("id", currentPageData.id);
    setIsSavingScale(false);
    if (!error) {
      setPages((prev) =>
        prev.map((p) => (p.id === currentPageData.id ? { ...p, scale_factor: sf, scale_calibrated_at: calibratedAt } : p))
      );
    }
    setCalibrateStep(null);
    setCalibratePoints([]);
    setDistanceInput("");
    setTool("select");
  }

  function confirmDistanceCalibration() {
    const [a, b] = calibratePoints;
    if (!a || !b) return;
    const pixelDist = Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
    if (pixelDist < 1) return;
    let realDistM = parseFloat(distanceInput);
    if (isNaN(realDistM) || realDistM <= 0) return;
    if (distanceUnit === "mm") realDistM /= 1000;
    saveScaleFactor(realDistM / pixelDist);
  }

  function confirmRatioCalibration() {
    const denomStr = ratioScale === "custom" ? ratioCustom : ratioScale;
    const denom = parseInt(denomStr);
    if (isNaN(denom) || denom <= 0 || !imgSize.w) return;
    const paper = PAPER_SIZES[ratioPaperSize];
    if (!paper) return;
    const pdfLong = Math.max(imgSize.w, imgSize.h) / RENDER_SCALE;
    saveScaleFactor((Math.max(paper.w, paper.h) * denom) / pdfLong);
  }

  function cancelCalibration() {
    setCalibrateStep(null);
    setCalibratePoints([]);
    setDistanceInput("");
    setTool("select");
  }

  function startTwoPointCalibration() {
    setShowFirstTimeModal(false);
    setTool("calibrate");
    setCalibrateStep("awaiting_A");
    setCalibratePoints([]);
  }

  function startRatioCalibration() {
    setShowFirstTimeModal(false);
    setCalibrateStep("ratio_dialog");
  }

  function confirmRecalibrate() {
    setShowRecalibrateConfirm(false);
    setTool("calibrate");
    setCalibrateStep("awaiting_A");
    setCalibratePoints([]);
  }

  function handleCalibrateToolPress() {
    if (scaleFactor !== null) setShowRecalibrateConfirm(true);
    else setShowFirstTimeModal(true);
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const dispW = imgSize.w / RENDER_SCALE;
  const dispH = imgSize.h / RENDER_SCALE;

  const cursor =
    spaceDown || isDragging
      ? isDragging ? "grabbing" : "grab"
      : tool === "pan" ? "grab"
      : tool === "select" ? "default"
      : "crosshair";

  const calibratePixelDist =
    calibratePoints[0] && calibratePoints[1]
      ? Math.sqrt((calibratePoints[1].x - calibratePoints[0].x) ** 2 + (calibratePoints[1].y - calibratePoints[0].y) ** 2)
      : null;

  const ratioPreviewScaleFactor = (() => {
    const denomStr = ratioScale === "custom" ? ratioCustom : ratioScale;
    const denom = parseInt(denomStr);
    if (isNaN(denom) || denom <= 0 || !imgSize.w) return null;
    const paper = PAPER_SIZES[ratioPaperSize];
    if (!paper) return null;
    const pdfLong = Math.max(imgSize.w, imgSize.h) / RENDER_SCALE;
    return (Math.max(paper.w, paper.h) * denom) / pdfLong;
  })();

  const liveArea =
    areaPoints.length >= 2 && scaleFactor
      ? computePolygonArea([...areaPoints, cursorPos], scaleFactor)
      : null;

  const selectedItem = takeoffItems.find((i) => i.id === selectedItemId) ?? null;
  const showLeftPanel = showToolOptions || (tool === "select" && selectedItem !== null);

  const tools: { id: Tool; icon: React.ReactNode; label: string; key: string; disabled?: boolean }[] = [
    { id: "select", icon: <MousePointer2 className="h-4 w-4" />, label: "Select", key: "V" },
    { id: "pan", icon: <Hand className="h-4 w-4" />, label: "Pan", key: "H" },
    { id: "calibrate", icon: <Ruler className="h-4 w-4" />, label: "Calibrate", key: "C" },
    { id: "area", icon: <PenLine className="h-4 w-4" />, label: "Area", key: "A", disabled: scaleFactor === null },
    { id: "linear", icon: <PenLine className="h-4 w-4" />, label: "Linear", key: "L", disabled: scaleFactor === null },
    { id: "count", icon: <Hash className="h-4 w-4" />, label: "Count", key: "P", disabled: scaleFactor === null },
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-screen flex flex-col bg-[hsl(240_22%_4%)] overflow-hidden">

      {/* ── Top bar ── */}
      <div className="h-11 shrink-0 bg-card/65 backdrop-blur-xl border-b border-border flex items-center px-3 gap-2 text-sm z-10">
        <Link href={`/projects/${projectId}`} className="text-muted-foreground hover:text-foreground transition-colors truncate max-w-[140px]">
          {projectName}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="font-medium truncate">{drawingName}</span>
        <div className="flex-1" />

        {scaleFactor !== null ? (
          <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md bg-success/10 border border-success/25 text-success text-xs font-medium">
            <Check className="h-3 w-3" />
            1 m = {Math.round(1 / scaleFactor)} px
          </div>
        ) : (
          <button
            onClick={handleCalibrateToolPress}
            className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md bg-warning/10 border border-warning/25 text-warning text-xs font-medium hover:bg-warning/20 transition-colors"
          >
            <Ruler className="h-3 w-3" />
            Not calibrated
          </button>
        )}

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => applyZoom(-ZOOM_STEP)} title="Zoom out (−)">
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs text-muted-foreground w-12 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => applyZoom(ZOOM_STEP)} title="Zoom in (+)">
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fitToScreen} title="Fit to screen (Shift+Z)">
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        {pageCount > 1 && (
          <div className="flex items-center gap-1 border-l border-border pl-2">
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums w-16 text-center">{currentPage} / {pageCount}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={currentPage >= pageCount} onClick={() => setCurrentPage((p) => p + 1)}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 min-h-0 relative">

        {/* ── Left panel: tool icons + options ── */}
        <div className={[
          "shrink-0 border-r border-border bg-card/40 flex z-10 transition-[width] duration-150",
          showLeftPanel ? "w-52" : "w-10",
        ].join(" ")}>

          {/* Tool icons rail */}
          <div className="w-10 shrink-0 flex flex-col items-center py-2 gap-1">
            {tools.map((t) => (
              <button
                key={t.id}
                title={`${t.label} (${t.key})`}
                disabled={t.disabled}
                onClick={() => {
                  if (t.disabled) return;
                  if (t.id === "calibrate") { handleCalibrateToolPress(); return; }
                  setTool(t.id);
                  setCalibrateStep(null);
                  setCalibratePoints([]);
                }}
                className={[
                  "h-8 w-8 rounded-md flex items-center justify-center transition-colors",
                  t.disabled
                    ? "opacity-25 cursor-not-allowed text-foreground"
                    : tool === t.id
                    ? "bg-primary/20 text-primary"
                    : "text-foreground/50 hover:bg-muted/40 hover:text-foreground",
                ].join(" ")}
              >
                {t.icon}
              </button>
            ))}
          </div>

          {/* Tool options panel */}
          {showLeftPanel && (
            <div className="flex-1 border-l border-border/50 p-3 space-y-3 overflow-y-auto">

              {/* Drawing tool options (area / linear / count) */}
              {showToolOptions && (
                <>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {tool === "area" ? "Area" : tool === "linear" ? "Linear" : "Count"} options
                  </p>

                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Label *</Label>
                    <Input
                      value={itemLabel}
                      onChange={(e) => setItemLabel(e.target.value)}
                      placeholder="e.g. VYL1 Corridor"
                      className={["h-7 text-xs", showLabelWarning ? "border-destructive" : ""].join(" ")}
                    />
                    {showLabelWarning && <p className="text-[10px] text-destructive">Enter a label first</p>}
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Scope</Label>
                    <Select value={itemScope} onValueChange={(v) => { const s = v as ScopeCategory; setItemScope(s); setItemColour(SCOPE_COLOURS[s]); }}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SCOPE_CATEGORIES.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Colour</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={itemColour}
                        onChange={(e) => setItemColour(e.target.value)}
                        className="h-7 w-8 rounded cursor-pointer border border-border bg-transparent p-0.5"
                      />
                      <span className="text-xs text-muted-foreground tabular-nums">{itemColour}</span>
                    </div>
                  </div>

                  {areaPoints.length > 0 && (
                    <div className="space-y-1 pt-1 border-t border-border/50">
                      <p className="text-[10px] text-muted-foreground">
                        {areaPoints.length} point{areaPoints.length !== 1 ? "s" : ""} placed
                      </p>
                      {isSelfIntersecting && (
                        <p className="text-[10px] text-destructive flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Edges crossing — fix before closing
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground">Double-click or Enter to close · Esc to cancel</p>
                    </div>
                  )}
                </>
              )}

              {/* Selected item info (select tool) */}
              {selectedItem && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <div className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: selectedItem.color }} />
                    <span className="text-xs font-medium truncate">{selectedItem.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {selectedItem.computed_value.toFixed(2)} {selectedItem.unit === "m2" ? "m²" : selectedItem.unit}
                  </p>
                  <button
                    onClick={() => setPendingDeleteId(selectedItem.id)}
                    className="flex items-center gap-1 text-[10px] text-destructive hover:text-destructive/80 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Canvas area ── */}
        <div ref={containerRef} className="flex-1 relative overflow-hidden" style={{ cursor }}>
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center z-20">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground">Loading drawing…</p>
              </div>
            </div>
          )}

          {!isLoading && !signedUrl && (
            <div className="absolute inset-0 flex items-center justify-center z-20">
              <p className="text-sm text-muted-foreground">Could not load drawing.</p>
            </div>
          )}

          {(calibrateStep === "awaiting_A" || calibrateStep === "awaiting_B") && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-medium pointer-events-none">
              {calibrateStep === "awaiting_A" ? "Click point A on the drawing" : "Click point B · Esc to cancel"}
            </div>
          )}

          {containerSize.w > 0 && (
            <Stage
              ref={stageRef}
              width={containerSize.w}
              height={containerSize.h}
              x={stagePos.x}
              y={stagePos.y}
              scaleX={zoom}
              scaleY={zoom}
              draggable={spaceDown || tool === "pan"}
              onDragStart={() => setIsDragging(true)}
              onDragEnd={(e) => { setIsDragging(false); setStagePos({ x: e.target.x(), y: e.target.y() }); }}
              onWheel={handleWheel}
              onMouseMove={handleMouseMove}
              onClick={handleStageClick}
              onDblClick={handleStageDblClick}
            >
              <Layer>
                {/* Drawing image */}
                {pageCanvas && <KonvaImage image={pageCanvas} x={0} y={0} width={dispW} height={dispH} />}

                {/* Saved takeoff items */}
                {takeoffItems.filter((item) => item.type === "area").map((item) => {
                  const isSelected = selectedItemId === item.id;
                  const pts = item.geometry.points.flatMap(([x, y]) => [x, y]);
                  return (
                    <KonvaLine
                      key={item.id}
                      points={pts}
                      closed
                      fill={hexWithOpacity(item.color, isSelected ? 0.4 : 0.2)}
                      stroke={item.color}
                      strokeWidth={(isSelected ? 2.5 : 1.5) / zoom}
                      listening={tool === "select"}
                      onClick={(e) => {
                        e.cancelBubble = true;
                        setSelectedItemId(item.id);
                      }}
                    />
                  );
                })}

                {/* Vertex handles for selected polygon */}
                {tool === "select" && selectedItem?.type === "area" &&
                  selectedItem.geometry.points.map(([x, y], idx) => (
                    <KonvaCircle
                      key={idx}
                      x={x}
                      y={y}
                      radius={5 / zoom}
                      fill="white"
                      stroke={selectedItem.color}
                      strokeWidth={1.5 / zoom}
                      draggable
                      onDragMove={(e) => handleVertexDragMove(selectedItem.id, idx, e)}
                      onDragEnd={() => handleVertexDragEnd(selectedItem.id)}
                    />
                  ))
                }

                {/* In-progress area polygon preview */}
                {tool === "area" && areaPoints.length > 0 && (
                  <>
                    <KonvaLine
                      points={[...areaPoints, cursorPos].flatMap((p) => [p.x, p.y])}
                      stroke={isSelfIntersecting ? "#F87171" : itemColour}
                      strokeWidth={2 / zoom}
                      fill={areaPoints.length >= 2 ? hexWithOpacity(itemColour, 0.2) : "transparent"}
                      closed
                      listening={false}
                      perfectDrawEnabled={false}
                    />
                    {areaPoints.map((pt, i) => (
                      <KonvaCircle
                        key={i}
                        x={pt.x}
                        y={pt.y}
                        radius={4 / zoom}
                        fill="white"
                        stroke={itemColour}
                        strokeWidth={1.5 / zoom}
                        listening={false}
                      />
                    ))}
                    {liveArea !== null && (
                      <KonvaText
                        x={cursorPos.x + 12 / zoom}
                        y={cursorPos.y - 18 / zoom}
                        text={`${liveArea.toFixed(2)} m²`}
                        fill="white"
                        fontSize={12 / zoom}
                        fontFamily="monospace"
                        shadowColor="black"
                        shadowBlur={4 / zoom}
                        shadowOpacity={0.9}
                        listening={false}
                      />
                    )}
                  </>
                )}

                {/* Calibration markers */}
                {calibratePoints[0] && (
                  <KonvaCircle x={calibratePoints[0].x} y={calibratePoints[0].y} radius={6 / zoom} fill="#8B5CF6" stroke="white" strokeWidth={1.5 / zoom} />
                )}
                {calibratePoints[1] && (
                  <>
                    <KonvaCircle x={calibratePoints[1].x} y={calibratePoints[1].y} radius={6 / zoom} fill="#8B5CF6" stroke="white" strokeWidth={1.5 / zoom} />
                    <KonvaLine
                      points={[calibratePoints[0].x, calibratePoints[0].y, calibratePoints[1].x, calibratePoints[1].y]}
                      stroke="#8B5CF6"
                      strokeWidth={2 / zoom}
                      dash={[8 / zoom, 4 / zoom]}
                    />
                  </>
                )}
              </Layer>
            </Stage>
          )}
        </div>

        {/* ── Legend sidebar placeholder ── */}
        <div className="w-56 shrink-0 border-l border-border bg-card/40 flex flex-col z-10">
          <div className="h-10 border-b border-border flex items-center px-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Takeoff items</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {takeoffItems.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-xs text-muted-foreground text-center px-4">
                  {scaleFactor === null ? "Set scale to start." : "Items will appear here once you start marking up."}
                </p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {takeoffItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => { setTool("select"); setSelectedItemId(item.id); }}
                    className={[
                      "w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors",
                      selectedItemId === item.id ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/20 border border-transparent",
                    ].join(" ")}
                  >
                    <div className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-xs truncate flex-1">{item.label}</span>
                    <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                      {item.computed_value.toFixed(2)} {item.unit === "m2" ? "m²" : item.unit}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── First-time calibration modal ── */}
        {showFirstTimeModal && !isLoading && (
          <div className="absolute inset-0 bg-background/75 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-card border border-border rounded-xl shadow-2xl p-6 w-[420px] space-y-4">
              <div className="space-y-1">
                <h3 className="font-semibold text-base">Set scale for this page</h3>
                <p className="text-sm text-muted-foreground">Scale must be set before you can start measuring. Choose a calibration method.</p>
              </div>
              <div className="grid gap-2">
                <button onClick={startTwoPointCalibration} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors text-left">
                  <div className="mt-0.5 h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                    <Ruler className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">Click two points</p>
                    <p className="text-xs text-muted-foreground">Click any two known points and enter the real-world distance. Most accurate.</p>
                  </div>
                </button>
                <button onClick={startRatioCalibration} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-border/80 hover:bg-muted/20 transition-colors text-left">
                  <div className="mt-0.5 h-7 w-7 rounded-full bg-muted/50 flex items-center justify-center shrink-0">
                    <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">Enter scale ratio</p>
                    <p className="text-xs text-muted-foreground">Enter the drawing&apos;s scale (e.g. 1:100) and paper size. Less accurate if PDF was not printed to size.</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Status bar ── */}
      <div className="h-6 shrink-0 bg-card/40 border-t border-border flex items-center px-3 gap-4 text-[10px] text-muted-foreground font-mono z-10">
        <span>
          {scaleFactor
            ? `${(cursorPos.x * scaleFactor).toFixed(2)} m, ${(cursorPos.y * scaleFactor).toFixed(2)} m`
            : `${Math.round(cursorPos.x)} px, ${Math.round(cursorPos.y)} px`}
        </span>
        <span className="text-border">|</span>
        <span>
          {calibrateStep === "awaiting_A" ? "Calibrate — click point A"
            : calibrateStep === "awaiting_B" ? "Calibrate — click point B"
            : areaPoints.length > 0 ? `Area — ${areaPoints.length} pts${liveArea !== null ? ` · ${liveArea.toFixed(2)} m²` : ""}`
            : `${tool.charAt(0).toUpperCase() + tool.slice(1)} tool`}
        </span>
        <span className="text-border">|</span>
        <span>Space+drag or H to pan · Scroll to zoom · Shift+Z to fit</span>
      </div>

      {/* ── Distance calibration dialog ── */}
      <Dialog open={calibrateStep === "distance_dialog"} onOpenChange={(open) => { if (!open) cancelCalibration(); }}>
        <DialogContent className="sm:max-w-sm bg-card/90 backdrop-blur-xl">
          <DialogHeader><DialogTitle>Set scale — two-point calibration</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-1">
            {calibratePixelDist !== null && (
              <p className="text-xs text-muted-foreground">Measured span: {calibratePixelDist.toFixed(1)} px on canvas</p>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Real-world distance *</Label>
              <div className="flex gap-2">
                <Input
                  type="number" min="0.001" step="any" placeholder="e.g. 3.6"
                  value={distanceInput} onChange={(e) => setDistanceInput(e.target.value)}
                  className="flex-1" autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") confirmDistanceCalibration(); }}
                />
                <Select value={distanceUnit} onValueChange={(v) => setDistanceUnit(v as "m" | "mm")}>
                  <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="m">m</SelectItem>
                    <SelectItem value="mm">mm</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <button onClick={() => setCalibrateStep("ratio_dialog")} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors">
              Use scale ratio instead
            </button>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={cancelCalibration}>Cancel</Button>
            <Button size="sm" disabled={!distanceInput || parseFloat(distanceInput) <= 0 || isSavingScale} onClick={confirmDistanceCalibration}>
              {isSavingScale ? "Saving…" : "Set scale"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Ratio calibration dialog ── */}
      <Dialog open={calibrateStep === "ratio_dialog"} onOpenChange={(open) => { if (!open) cancelCalibration(); }}>
        <DialogContent className="sm:max-w-sm bg-card/90 backdrop-blur-xl">
          <DialogHeader><DialogTitle>Set scale — drawing scale ratio</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="flex items-start gap-2 p-2.5 rounded-md bg-warning/10 border border-warning/25 text-warning text-xs">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>Less accurate — only use if the drawing&apos;s scale stamp is trustworthy and the PDF was printed to size.</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Scale (1 : N)</Label>
                <Select value={ratioScale} onValueChange={(v) => { setRatioScale(v); if (v !== "custom") setRatioCustom(""); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RATIO_PRESETS.map((p) => <SelectItem key={p} value={p}>1:{p}</SelectItem>)}
                    <SelectItem value="custom">Custom…</SelectItem>
                  </SelectContent>
                </Select>
                {ratioScale === "custom" && (
                  <Input type="number" min="1" placeholder="e.g. 75" value={ratioCustom} onChange={(e) => setRatioCustom(e.target.value)} autoFocus />
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Paper size</Label>
                <Select value={ratioPaperSize} onValueChange={setRatioPaperSize}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(PAPER_SIZES).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {ratioPreviewScaleFactor !== null && (
              <p className="text-xs text-muted-foreground">
                Preview: 1 px ≈ {(ratioPreviewScaleFactor * 1000).toFixed(2)} mm · 1 m = {Math.round(1 / ratioPreviewScaleFactor)} px
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={cancelCalibration}>Cancel</Button>
            <Button size="sm" disabled={isSavingScale || (ratioScale === "custom" && (!ratioCustom || parseInt(ratioCustom) <= 0))} onClick={confirmRatioCalibration}>
              {isSavingScale ? "Saving…" : "Set scale"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Re-calibrate confirm ── */}
      <Dialog open={showRecalibrateConfirm} onOpenChange={(open) => { if (!open) setShowRecalibrateConfirm(false); }}>
        <DialogContent className="sm:max-w-sm bg-card/90 backdrop-blur-xl">
          <DialogHeader><DialogTitle>Re-calibrate this page?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground pt-1">All takeoff measurements on this page will be recomputed using the new scale. This cannot be undone.</p>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setShowRecalibrateConfirm(false)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={confirmRecalibrate}>Re-calibrate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirm ── */}
      <Dialog open={!!pendingDeleteId} onOpenChange={(open) => { if (!open) setPendingDeleteId(null); }}>
        <DialogContent className="sm:max-w-xs bg-card/90 backdrop-blur-xl">
          <DialogHeader><DialogTitle>Delete this item?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground pt-1">
            {takeoffItems.find((i) => i.id === pendingDeleteId)?.label ?? "This item"} will be permanently removed.
          </p>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setPendingDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={confirmDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
