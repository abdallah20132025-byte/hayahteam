CREATE TABLE IF NOT EXISTS site_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  dept TEXT NOT NULL,
  year TEXT NOT NULL,
  member_status TEXT NOT NULL,
  phone TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'جديد',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_applications_created_at ON applications(created_at DESC);
