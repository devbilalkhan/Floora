"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Trash2, ChevronDown, Ban } from "lucide-react";
import { updateOrgPlan, cancelSubscription, deleteOrg } from "./actions";

type Plan = {
  plan: string;
  status: string;
  orgLimit: number;
  trialEndsAt: string | null;
};

type Owner = {
  id: string;
  name: string | null;
  email: string | null;
};

type Row = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  memberCount: number;
  owner: Owner | null;
  plan: Plan | null;
};

const PLAN_OPTIONS = ["basic", "pro", "enterprise"] as const;
const STATUS_OPTIONS = ["trial", "active", "cancelled"] as const;

const STATUS_STYLE: Record<string, string> = {
  active:    "bg-success/10 text-success border-success/20",
  trial:     "bg-blue-400/10 text-blue-400 border-blue-400/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
};

function trialDaysLeft(endsAt: string | null): number | null {
  if (!endsAt) return null;
  const diff = Math.ceil(
    (new Date(endsAt).getTime() - Date.now()) / 86_400_000
  );
  return diff;
}

function PlanCell({ row }: { row: Row }) {
  const [editing, setEditing] = useState(false);
  const [plan, setPlan]     = useState(row.plan?.plan     ?? "basic");
  const [status, setStatus] = useState(row.plan?.status   ?? "trial");
  const [limit, setLimit]   = useState(row.plan?.orgLimit ?? 2);
  const [pending, startTransition] = useTransition();

  if (!row.owner) return <span className="text-muted-foreground/50 text-xs">—</span>;

  function save() {
    startTransition(async () => {
      try {
        await updateOrgPlan(row.owner!.id, {
          plan,
          status,
          org_limit: limit,
        });
        toast.success("Plan updated.");
        setEditing(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to update plan.");
      }
    });
  }

  if (!editing) {
    const days = trialDaysLeft(row.plan?.trialEndsAt ?? null);
    return (
      <button
        onClick={() => setEditing(true)}
        className="flex items-center gap-1.5 group"
        title="Click to edit"
      >
        <span className={cn(
          "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium capitalize",
          STATUS_STYLE[row.plan?.status ?? "trial"] ?? STATUS_STYLE.trial
        )}>
          {row.plan?.status ?? "trial"}
          {row.plan?.status === "trial" && days !== null && (
            <span className="opacity-70">· {days}d</span>
          )}
        </span>
        <span className="text-xs text-muted-foreground capitalize">
          {row.plan?.plan ?? "basic"}
        </span>
        <ChevronDown className="h-3 w-3 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 py-1">
      <div className="flex items-center gap-1.5 flex-wrap">
        {PLAN_OPTIONS.map((p) => (
          <button
            key={p}
            onClick={() => setPlan(p)}
            className={cn(
              "rounded border px-2 py-0.5 text-[10px] font-medium capitalize transition-colors",
              plan === p
                ? "bg-primary/10 text-primary border-primary/30"
                : "text-muted-foreground border-transparent hover:border-border"
            )}
          >
            {p}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={cn(
              "rounded border px-2 py-0.5 text-[10px] font-medium capitalize transition-colors",
              status === s
                ? cn(STATUS_STYLE[s], "border-current")
                : "text-muted-foreground border-transparent hover:border-border"
            )}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground">Org limit:</span>
        <select
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          className="h-5 rounded border border-white/[0.12] bg-muted/40 px-1 text-[10px] text-foreground focus:outline-none"
        >
          <option value={1}>1</option>
          <option value={2}>2</option>
          <option value={5}>5</option>
          <option value={10}>10</option>
          <option value={-1}>Unlimited</option>
        </select>
      </div>
      <div className="flex gap-1.5 mt-0.5">
        <button
          onClick={save}
          disabled={pending}
          className="rounded px-2 py-0.5 text-[10px] font-medium bg-primary text-primary-foreground disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          onClick={() => setEditing(false)}
          className="rounded px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function ActionsCell({ row }: { row: Row }) {
  const [pending, startTransition] = useTransition();

  function handleCancel() {
    if (!row.owner) return;
    if (!confirm(`Cancel subscription for ${row.name}? They will lose access.`)) return;
    startTransition(async () => {
      try {
        await cancelSubscription(row.owner!.id);
        toast.success("Subscription cancelled.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed.");
      }
    });
  }

  function handleDelete() {
    if (!confirm(`Permanently delete "${row.name}" and ALL its data? This cannot be undone.`)) return;
    startTransition(async () => {
      try {
        await deleteOrg(row.id);
        toast.success(`"${row.name}" deleted.`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed.");
      }
    });
  }

  return (
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      {row.owner && row.plan?.status !== "cancelled" && (
        <button
          onClick={handleCancel}
          disabled={pending}
          title="Cancel subscription"
          className="rounded p-1 text-muted-foreground hover:text-orange-400 hover:bg-orange-400/10 transition-colors disabled:opacity-40"
        >
          <Ban className="h-3.5 w-3.5" />
        </button>
      )}
      <button
        onClick={handleDelete}
        disabled={pending}
        title="Delete organization"
        className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function AdminTable({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-xl flex items-center justify-center h-48">
        <p className="text-sm text-muted-foreground">No organizations yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.08] overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.08] bg-muted/30">
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Organization</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Owner</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Plan / Status</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Members</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Created</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.id}
              className={cn(
                "group border-b border-white/[0.05] last:border-0 transition-colors",
                "hover:bg-muted/20"
              )}
            >
              {/* Org */}
              <td className="px-4 py-3">
                <a
                  href={`/orgs/${row.slug}/projects`}
                  className="font-medium hover:text-primary transition-colors"
                >
                  {row.name}
                </a>
                <p className="text-[10px] text-muted-foreground/60">{row.slug}</p>
              </td>

              {/* Owner */}
              <td className="px-4 py-3">
                {row.owner ? (
                  <>
                    <p className="text-xs font-medium">{row.owner.name ?? "—"}</p>
                    <p className="text-[10px] text-muted-foreground">{row.owner.email}</p>
                  </>
                ) : (
                  <span className="text-muted-foreground/50 text-xs">No admin</span>
                )}
              </td>

              {/* Plan */}
              <td className="px-4 py-3">
                <PlanCell row={row} />
              </td>

              {/* Members */}
              <td className="px-4 py-3">
                <span className="tabular-nums text-xs text-muted-foreground">
                  {row.memberCount}
                </span>
              </td>

              {/* Created */}
              <td className="px-4 py-3">
                <span className="text-xs text-muted-foreground">
                  {new Date(row.createdAt).toLocaleDateString("en-AU", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </td>

              {/* Actions */}
              <td className="px-4 py-3">
                <ActionsCell row={row} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
