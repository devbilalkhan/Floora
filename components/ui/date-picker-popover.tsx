"use client";

import { useState } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatLabel(dateStr: string): { label: string; overdue: boolean } {
  const date = new Date(dateStr + "T00:00:00");
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const diff = Math.round((date.getTime() - now.getTime()) / 86_400_000);
  const overdue = diff < 0;
  const label =
    diff === 0   ? "Today"
    : diff === 1   ? "Tomorrow"
    : diff === -1  ? "Yesterday"
    : diff > 1 && diff <= 6
      ? date.toLocaleDateString("en-AU", { weekday: "short" })
      : date.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
  return { label, overdue };
}

function getTodayStr() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

function getTomorrowStr() {
  const t = new Date(); t.setDate(t.getDate() + 1);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

export function DatePickerPopover({
  value,
  onChange,
  className,
}: {
  value: string | null;
  onChange: (date: string | null) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const due = value ? formatLabel(value) : null;

  function pick(dateStr: string | null) {
    onChange(dateStr);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {due ? (
          <button
            className={cn(
              "flex items-center gap-1 text-[10px] font-medium hover:opacity-70 transition-opacity",
              due.overdue ? "text-red-400" : "text-muted-foreground",
              className
            )}
          >
            <CalendarIcon className="h-2.5 w-2.5 flex-shrink-0" />
            {due.label}
          </button>
        ) : (
          <button
            title="Set due date"
            className={cn(
              "flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-primary/70 transition-colors",
              className
            )}
          >
            <CalendarIcon className="h-2.5 w-2.5 flex-shrink-0" />
            <span className="hidden group-hover:inline">Add date</span>
          </button>
        )}
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-auto p-0 border-white/[0.08] bg-card/95 backdrop-blur-xl shadow-2xl"
      >
        {/* Quick chips */}
        <div className="flex items-center gap-1.5 px-3 pt-3 pb-1">
          {[
            { label: "Today",    val: getTodayStr()    },
            { label: "Tomorrow", val: getTomorrowStr() },
          ].map(({ label, val }) => (
            <button
              key={label}
              onClick={() => pick(val)}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11px] font-medium border transition-colors",
                value === val
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "text-muted-foreground border-white/[0.12] hover:text-foreground hover:bg-muted/40"
              )}
            >
              {label}
            </button>
          ))}
          {value && (
            <button
              onClick={() => pick(null)}
              className="ml-auto rounded-md px-2.5 py-1 text-[11px] font-medium text-muted-foreground/60 hover:text-destructive border border-transparent hover:border-destructive/30 transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* shadcn Calendar */}
        <Calendar
          mode="single"
          selected={value ? new Date(value + "T00:00:00") : undefined}
          onSelect={(date) => { if (date) pick(toDateStr(date)); }}
        />
      </PopoverContent>
    </Popover>
  );
}
