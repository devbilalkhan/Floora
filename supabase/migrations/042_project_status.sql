-- Widen project status to include completed and rejected
ALTER TABLE projects
  DROP CONSTRAINT IF EXISTS projects_status_check;

ALTER TABLE projects
  ADD CONSTRAINT projects_status_check
    CHECK (status IN ('active', 'archived', 'completed', 'rejected'));
