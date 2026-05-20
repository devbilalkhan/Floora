"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Mail, Trash2, X, Clock } from "lucide-react";
import { toast } from "sonner";
import {
  getOrgMembers,
  inviteOrgMember,
  updateMemberRole,
  removeMember,
  cancelInvite,
} from "./actions";

const ORG_ROLES = [
  { value: "admin", label: "Admin" },
  { value: "project_manager", label: "Project Manager" },
  { value: "estimator", label: "Estimator" },
  { value: "viewer", label: "Viewer" },
];

const inputCls =
  "w-full text-sm bg-card/65 backdrop-blur-xl border border-border rounded-xl px-4 py-2.5 text-foreground/80 placeholder:text-muted-foreground/30 outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-50";

const selectCls =
  "text-xs bg-card/65 border border-border rounded-lg px-2 py-1 text-foreground/80 outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-50";

type Member = { user_id: string; email: string; org_role: string };
type Invite = { id: string; email: string; role: string; created_at: string; expires_at: string };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function MembersTab({
  orgSlug,
  orgId,
  currentUserId,
}: {
  orgSlug: string;
  orgId: string;
  currentUserId: string;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("estimator");
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    getOrgMembers(orgId).then(({ members: m, invites: i }) => {
      setMembers(m);
      setInvites(i);
      setLoading(false);
    });
  }, [orgId]);

  async function handleInvite() {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setError("");
    try {
      const { alreadyRegistered } = await inviteOrgMember(orgSlug, orgId, inviteEmail, inviteRole);
      const normalised = inviteEmail.toLowerCase().trim();
      setInvites((prev) => [
        {
          id: crypto.randomUUID(),
          email: normalised,
          role: inviteRole,
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
        },
        ...prev,
      ]);
      setInviteEmail("");
      if (alreadyRegistered) {
        toast.success(`${normalised} already has an account — they'll see this org on next sign-in.`);
      } else {
        toast.success(`Invite sent to ${normalised}.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invite.");
    } finally {
      setInviting(false);
    }
  }

  async function handleRoleChange(memberId: string, newRole: string) {
    setError("");
    try {
      await updateMemberRole(orgSlug, orgId, memberId, newRole);
      setMembers((prev) =>
        prev.map((m) => (m.user_id === memberId ? { ...m, org_role: newRole } : m))
      );
      toast.success("Role updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update role.");
    }
  }

  async function handleRemove(memberId: string) {
    setError("");
    try {
      await removeMember(orgSlug, orgId, memberId);
      setMembers((prev) => prev.filter((m) => m.user_id !== memberId));
      toast.success("Member removed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove member.");
    }
  }

  async function handleCancelInvite(inviteId: string) {
    setError("");
    try {
      await cancelInvite(orgSlug, inviteId);
      setInvites((prev) => prev.filter((i) => i.id !== inviteId));
      toast.success("Invite cancelled.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel invite.");
    }
  }

  return (
    <div className="space-y-8">
      {/* Invite form */}
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">Invite Member</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Send an invite email. The recipient must click the link to join.
          </p>
        </div>
        <div className="flex items-end gap-3">
          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Email address
            </label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@example.com"
              className={inputCls}
              onKeyDown={(e) => e.key === "Enter" && handleInvite()}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Role
            </label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="text-sm bg-card/65 backdrop-blur-xl border border-border rounded-xl px-3 py-2.5 text-foreground/80 outline-none focus:ring-1 focus:ring-primary/40"
            >
              {ORG_ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <Button
            onClick={handleInvite}
            disabled={inviting || !inviteEmail.trim()}
            size="sm"
            className="gap-1.5 self-end"
          >
            <Mail className="h-3.5 w-3.5" />
            {inviting ? "Sending…" : "Send invite"}
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>

      {/* Members table */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold">
          Members{" "}
          {!loading && (
            <span className="text-sm font-normal text-muted-foreground">
              · {members.length}
            </span>
          )}
        </h2>
        <div className="border border-black/10 dark:border-white/10 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-black/10 dark:border-white/10 bg-muted/40">
                {["Email", "Role", ""].map((h) => (
                  <th
                    key={h}
                    className="text-left px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wide"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b border-black/10 dark:border-white/10 last:border-0">
                    <td className="px-3 py-2.5"><Skeleton className="h-3.5 w-48" /></td>
                    <td className="px-3 py-2.5"><Skeleton className="h-5 w-24 rounded-lg" /></td>
                    <td className="px-2 py-2.5 w-8" />
                  </tr>
                ))
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-sm text-muted-foreground">
                    No members yet.
                  </td>
                </tr>
              ) : (
                members.map((m) => {
                  const isSelf = m.user_id === currentUserId;
                  return (
                    <tr
                      key={m.user_id}
                      className="group border-b border-black/10 dark:border-white/10 last:border-0 hover:bg-muted/10 transition-colors"
                    >
                      <td className="px-3 py-2 text-sm text-foreground/80">
                        {m.email}
                        {isSelf && (
                          <span className="ml-2 text-[10px] text-muted-foreground">(you)</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={m.org_role}
                          onChange={(e) => handleRoleChange(m.user_id, e.target.value)}
                          disabled={isSelf}
                          className={selectCls}
                        >
                          {ORG_ROLES.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-2 w-8">
                        {!isSelf && (
                          <button
                            onClick={() => handleRemove(m.user_id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                            title="Remove member"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending invites */}
      {(loading || invites.length > 0) && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold">
            Pending Invites{" "}
            {!loading && (
              <span className="text-sm font-normal text-muted-foreground">
                · {invites.length}
              </span>
            )}
          </h2>
          <div className="border border-black/10 dark:border-white/10 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-black/10 dark:border-white/10 bg-muted/40">
                  {["Email", "Role", "Expires", ""].map((h) => (
                    <th
                      key={h}
                      className="text-left px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({ length: 2 }).map((_, i) => (
                  <tr key={i} className="border-b border-black/10 dark:border-white/10 last:border-0">
                    <td className="px-3 py-2.5"><Skeleton className="h-3.5 w-48" /></td>
                    <td className="px-3 py-2.5"><Skeleton className="h-3.5 w-20" /></td>
                    <td className="px-3 py-2.5"><Skeleton className="h-3.5 w-16" /></td>
                    <td className="px-2 py-2.5 w-8" />
                  </tr>
                ))}
                {!loading && invites.map((inv) => (
                  <tr
                    key={inv.id}
                    className="group border-b border-black/10 dark:border-white/10 last:border-0 hover:bg-muted/10 transition-colors"
                  >
                    <td className="px-3 py-2 text-sm text-foreground/80">{inv.email}</td>
                    <td className="px-3 py-2 text-sm text-muted-foreground capitalize">
                      {inv.role.replace("_", " ")}
                    </td>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDate(inv.expires_at)}
                      </span>
                    </td>
                    <td className="px-2 py-2 w-8">
                      <button
                        onClick={() => handleCancelInvite(inv.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        title="Cancel invite"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
