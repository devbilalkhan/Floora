export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface ChecklistItem {
  id: string;
  task_id: string;
  text: string;
  done: boolean;
  position: number;
}

export interface Task {
  id: string;
  org_id: string;
  project_id: string | null;
  title: string;
  tags: string[];
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  assigned_to: string | null;
  is_private: boolean;
  is_pinned: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  checklist_items: ChecklistItem[];
}

export interface MentionSuggestion {
  value: string;
  label: string;
  type: "project" | "person";
}
