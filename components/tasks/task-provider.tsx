"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";

interface TaskCtx {
  open: boolean;
  setOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
}

const TaskCtx = createContext<TaskCtx>({ open: false, setOpen: () => {} });

export function TaskProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "j") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return <TaskCtx.Provider value={{ open, setOpen }}>{children}</TaskCtx.Provider>;
}

export const useTaskPanel = () => useContext(TaskCtx);
