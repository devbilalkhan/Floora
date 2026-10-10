"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormulaError, formulaFromDisplay, formulaToDisplay } from "@/lib/trade-sheet-formula";
import type { TradeSheetColumn } from "@/lib/trade-sheet-types";

export function FormulaDialog({
  column,
  columns,
  onClose,
  onSave,
}: {
  /** Column being edited; null closes the dialog. */
  column: TradeSheetColumn | null;
  columns: TradeSheetColumn[];
  onClose: () => void;
  onSave: (formula: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (column) {
      setText(column.formula ? formulaToDisplay(column.formula, columns) : "");
      setError(null);
    }
    // Only reset when a different column is opened
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [column?.id]);

  function insertReference(name: string) {
    const input = inputRef.current;
    const at = input?.selectionStart ?? text.length;
    const ref = `[${name}]`;
    setText(text.slice(0, at) + ref + text.slice(at));
    setError(null);
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(at + ref.length, at + ref.length);
    });
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!column) return;
    try {
      onSave(formulaFromDisplay(text, columns, column.id));
    } catch (err) {
      setError(err instanceof FormulaError ? err.message : "Invalid formula");
    }
  }

  const others = columns.filter((c) => c.id !== column?.id);

  return (
    <Dialog open={column !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-card/85 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle>Formula for &ldquo;{column?.name}&rdquo;</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <Input
              ref={inputRef}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setError(null);
              }}
              placeholder="[Qty] * [Rate]"
              className="font-mono text-xs"
              autoFocus
            />
            {error ? (
              <p className="text-xs text-destructive">{error}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Use + − * / and brackets. Applies to every row, e.g. <span className="font-mono">([Qty] + 2) * [Rate]</span>
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Insert column</p>
            <div className="flex flex-wrap gap-1.5">
              {others.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => insertReference(c.name)}
                  className="rounded border border-border bg-muted/40 px-2 py-0.5 text-xs text-foreground/70 hover:border-primary/40 hover:text-foreground"
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" size="sm" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm">
              Apply formula
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
