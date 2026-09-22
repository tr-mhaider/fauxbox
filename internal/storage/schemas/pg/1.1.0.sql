-- Phase 2: multi-tenant data model.
-- Adds control-plane / identity tables and a SandboxID column on the mail
-- tables. Existing single-tenant rows are assigned to a "default" sandbox so
-- the pre-multi-tenant code keeps working until context threading + RLS land.

CREATE TABLE IF NOT EXISTS {{ tenant "accounts" }} (
	ID TEXT PRIMARY KEY,
	Plan TEXT NOT NULL DEFAULT 'default',
	BillingRef TEXT,
	MaxMessages BIGINT NOT NULL DEFAULT 0,
	MaxStorageBytes BIGINT NOT NULL DEFAULT 0,
	MaxSandboxes INTEGER NOT NULL DEFAULT 0,
	RateLimit INTEGER NOT NULL DEFAULT 0,
	Created BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS {{ tenant "sandboxes" }} (
	ID TEXT PRIMARY KEY,
	AccountID TEXT NOT NULL,
	Subdomain CITEXT UNIQUE,
	SMTPUsername CITEXT UNIQUE,
	SMTPPasswordHash TEXT,
	MaxMessages BIGINT NOT NULL DEFAULT 0,
	MaxMessageSize BIGINT NOT NULL DEFAULT 0,
	RetentionHours INTEGER NOT NULL DEFAULT 0,
	RateLimit INTEGER NOT NULL DEFAULT 0,
	WebhookURL TEXT,
	Created BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS {{ tenant "idx_sandboxes_account" }} ON {{ tenant "sandboxes" }} (AccountID);

CREATE TABLE IF NOT EXISTS {{ tenant "users" }} (
	ID TEXT PRIMARY KEY,
	AccountID TEXT NOT NULL,
	Email CITEXT UNIQUE NOT NULL,
	PasswordHash TEXT NOT NULL,
	Role TEXT NOT NULL DEFAULT 'member',
	TokenVersion INTEGER NOT NULL DEFAULT 1,
	Created BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS {{ tenant "idx_users_account" }} ON {{ tenant "users" }} (AccountID);

CREATE TABLE IF NOT EXISTS {{ tenant "api_tokens" }} (
	ID TEXT PRIMARY KEY,
	AccountID TEXT NOT NULL,
	TokenHash TEXT NOT NULL,
	Scopes TEXT,
	Created BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS {{ tenant "idx_api_tokens_account" }} ON {{ tenant "api_tokens" }} (AccountID);

-- default account + sandbox that all existing data belongs to
INSERT INTO {{ tenant "accounts" }} (ID, Plan) VALUES ('default', 'default') ON CONFLICT (ID) DO NOTHING;
INSERT INTO {{ tenant "sandboxes" }} (ID, AccountID, Subdomain) VALUES ('default', 'default', 'default') ON CONFLICT (ID) DO NOTHING;

-- row-level tenant key on the mail tables
ALTER TABLE {{ tenant "mailbox" }} ADD COLUMN IF NOT EXISTS SandboxID TEXT NOT NULL DEFAULT 'default';
ALTER TABLE {{ tenant "tags" }} ADD COLUMN IF NOT EXISTS SandboxID TEXT NOT NULL DEFAULT 'default';
ALTER TABLE {{ tenant "message_tags" }} ADD COLUMN IF NOT EXISTS SandboxID TEXT NOT NULL DEFAULT 'default';

CREATE INDEX IF NOT EXISTS {{ tenant "idx_mailbox_sandbox" }} ON {{ tenant "mailbox" }} (SandboxID);
CREATE INDEX IF NOT EXISTS {{ tenant "idx_tags_sandbox" }} ON {{ tenant "tags" }} (SandboxID);
CREATE INDEX IF NOT EXISTS {{ tenant "idx_message_tags_sandbox" }} ON {{ tenant "message_tags" }} (SandboxID);
