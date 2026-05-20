"use client";

import { useEffect, useTransition } from "react";
import { checkForReplies } from "./actions";

export function ReplyChecker({
  projectId,
  orgSlug,
  hasGmail,
}: {
  projectId: string;
  orgSlug: string;
  hasGmail: boolean;
}) {
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!hasGmail) return;
    startTransition(() => {
      checkForReplies(projectId, orgSlug).catch(() => {});
    });
  // Only run on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
