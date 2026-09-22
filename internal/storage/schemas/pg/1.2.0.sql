-- Phase 2: Row-Level Security enforcement for sandbox isolation.
-- The mailpit_rls role (created by the app at startup) is a non-owner role that
-- these policies apply to. Sandbox-scoped queries SET LOCAL ROLE to it and set
-- app.current_sandbox; the owning login role bypasses RLS for maintenance.

ALTER TABLE {{ tenant "mailbox_data" }} ADD COLUMN IF NOT EXISTS SandboxID TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS {{ tenant "idx_mailbox_data_sandbox" }} ON {{ tenant "mailbox_data" }} (SandboxID);

-- tags are unique per sandbox, not globally
DROP INDEX IF EXISTS {{ tenant "idx_tag_name" }};
CREATE UNIQUE INDEX IF NOT EXISTS {{ tenant "idx_tag_sandbox_name" }} ON {{ tenant "tags" }} (SandboxID, Name);

-- new rows take their SandboxID from the request GUC, else the default sandbox
ALTER TABLE {{ tenant "mailbox" }} ALTER COLUMN SandboxID SET DEFAULT COALESCE(NULLIF(current_setting('app.current_sandbox', true), ''), 'default');
ALTER TABLE {{ tenant "mailbox_data" }} ALTER COLUMN SandboxID SET DEFAULT COALESCE(NULLIF(current_setting('app.current_sandbox', true), ''), 'default');
ALTER TABLE {{ tenant "tags" }} ALTER COLUMN SandboxID SET DEFAULT COALESCE(NULLIF(current_setting('app.current_sandbox', true), ''), 'default');
ALTER TABLE {{ tenant "message_tags" }} ALTER COLUMN SandboxID SET DEFAULT COALESCE(NULLIF(current_setting('app.current_sandbox', true), ''), 'default');

GRANT USAGE ON SCHEMA public TO mailpit_rls;
GRANT SELECT, INSERT, UPDATE, DELETE ON {{ tenant "mailbox" }} TO mailpit_rls;
GRANT SELECT, INSERT, UPDATE, DELETE ON {{ tenant "mailbox_data" }} TO mailpit_rls;
GRANT SELECT, INSERT, UPDATE, DELETE ON {{ tenant "tags" }} TO mailpit_rls;
GRANT SELECT, INSERT, UPDATE, DELETE ON {{ tenant "message_tags" }} TO mailpit_rls;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO mailpit_rls;

ALTER TABLE {{ tenant "mailbox" }} ENABLE ROW LEVEL SECURITY;
ALTER TABLE {{ tenant "mailbox_data" }} ENABLE ROW LEVEL SECURITY;
ALTER TABLE {{ tenant "tags" }} ENABLE ROW LEVEL SECURITY;
ALTER TABLE {{ tenant "message_tags" }} ENABLE ROW LEVEL SECURITY;

CREATE POLICY {{ tenant "sandbox_isolation" }} ON {{ tenant "mailbox" }} USING (SandboxID = current_setting('app.current_sandbox', true)) WITH CHECK (SandboxID = current_setting('app.current_sandbox', true));
CREATE POLICY {{ tenant "sandbox_isolation" }} ON {{ tenant "mailbox_data" }} USING (SandboxID = current_setting('app.current_sandbox', true)) WITH CHECK (SandboxID = current_setting('app.current_sandbox', true));
CREATE POLICY {{ tenant "sandbox_isolation" }} ON {{ tenant "tags" }} USING (SandboxID = current_setting('app.current_sandbox', true)) WITH CHECK (SandboxID = current_setting('app.current_sandbox', true));
CREATE POLICY {{ tenant "sandbox_isolation" }} ON {{ tenant "message_tags" }} USING (SandboxID = current_setting('app.current_sandbox', true)) WITH CHECK (SandboxID = current_setting('app.current_sandbox', true));
