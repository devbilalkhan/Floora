"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createDrawingRecord } from "./actions";
import { getPdfPageCount } from "@/lib/pdf-utils";

const MAX_SIZE_MB = 25;
const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg"];

export function UploadDrawingDialog({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState("floor_plan");
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;

    if (!ALLOWED_TYPES.includes(f.type)) {
      setError("Only PDF, PNG, and JPG files are supported.");
      return;
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`File must be under ${MAX_SIZE_MB} MB.`);
      return;
    }

    setError("");
    setFile(f);
    if (!name) {
      setName(f.name.replace(/\.[^.]+$/, ""));
    }
  }

  function reset() {
    setFile(null);
    setName("");
    setType("floor_plan");
    setError("");
    setProgress("");
    setPending(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !name.trim()) return;

    setPending(true);
    setError("");

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const drawingId = crypto.randomUUID();
      const ext = file.name.split(".").pop()!.toLowerCase();
      const storagePath = `${user.id}/${drawingId}.${ext}`;

      // Upload file
      setProgress("Uploading…");
      const { error: uploadError } = await supabase.storage
        .from("drawings")
        .upload(storagePath, file, { contentType: file.type });

      if (uploadError) throw new Error(uploadError.message);

      // Get page count
      let pageCount = 1;
      if (file.type === "application/pdf") {
        setProgress("Reading PDF…");
        pageCount = await getPdfPageCount(file);
      }

      // Create DB rows
      setProgress("Saving…");
      await createDrawingRecord({
        projectId,
        drawingId,
        name: name.trim(),
        type,
        storagePath,
        mimeType: file.type,
        pageCount,
      });

      setOpen(false);
      reset();
      router.push(`/projects/${projectId}/drawings/${drawingId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
      setPending(false);
      setProgress("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Upload className="h-3.5 w-3.5" />
          Upload drawing
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-card/85 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle>Upload drawing</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 pt-1">
          {error && <p className="text-xs text-destructive">{error}</p>}

          {/* Drop zone / file picker */}
          <div
            className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/40 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            {file ? (
              <div className="flex items-center justify-center gap-2">
                <span className="text-sm text-foreground truncate max-w-[200px]">
                  {file.name}
                </span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setFile(null); setName(""); }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                <Upload className="h-6 w-6 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">
                  Click to select a file
                </p>
                <p className="text-xs text-muted-foreground">
                  PDF, PNG, JPG · max {MAX_SIZE_MB} MB
                </p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dname" className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
              Drawing name *
            </Label>
            <Input
              id="dname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Level 2 Floor Plan"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
              Type
            </Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="floor_plan">Floor Plan</SelectItem>
                <SelectItem value="elevation">Elevation</SelectItem>
                <SelectItem value="detail">Detail</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={pending || !file}>
              {pending ? progress || "Uploading…" : "Upload"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
