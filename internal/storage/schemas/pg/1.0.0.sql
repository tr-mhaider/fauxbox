-- Consolidated PostgreSQL baseline schema for Fauxbox.
-- Replaces the historical SQLite migration chain with the final table shapes.
-- All identifiers are unquoted so PostgreSQL folds them to lower case
-- consistently between DDL and queries.

CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS {{ tenant "mailbox" }} (
	Created BIGINT NOT NULL,
	ID TEXT NOT NULL,
	MessageID TEXT NOT NULL,
	Subject TEXT NOT NULL,
	Metadata JSONB,
	Size BIGINT NOT NULL,
	Inline INTEGER NOT NULL,
	Attachments INTEGER NOT NULL,
	Read INTEGER NOT NULL DEFAULT 0,
	SearchText TEXT,
	Snippet TEXT NOT NULL DEFAULT ''
);

CREATE UNIQUE INDEX IF NOT EXISTS {{ tenant "idx_id" }} ON {{ tenant "mailbox" }} (ID);
CREATE INDEX IF NOT EXISTS {{ tenant "idx_created" }} ON {{ tenant "mailbox" }} (Created);
CREATE INDEX IF NOT EXISTS {{ tenant "idx_message_id" }} ON {{ tenant "mailbox" }} (MessageID);
CREATE INDEX IF NOT EXISTS {{ tenant "idx_subject" }} ON {{ tenant "mailbox" }} (Subject);
CREATE INDEX IF NOT EXISTS {{ tenant "idx_size" }} ON {{ tenant "mailbox" }} (Size);
CREATE INDEX IF NOT EXISTS {{ tenant "idx_inline" }} ON {{ tenant "mailbox" }} (Inline);
CREATE INDEX IF NOT EXISTS {{ tenant "idx_attachments" }} ON {{ tenant "mailbox" }} (Attachments);
CREATE INDEX IF NOT EXISTS {{ tenant "idx_read" }} ON {{ tenant "mailbox" }} (Read);

CREATE TABLE IF NOT EXISTS {{ tenant "mailbox_data" }} (
	ID TEXT NOT NULL,
	Email BYTEA,
	Compressed INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS {{ tenant "idx_data_id" }} ON {{ tenant "mailbox_data" }} (ID);

CREATE TABLE IF NOT EXISTS {{ tenant "tags" }} (
	ID BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	Name CITEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS {{ tenant "idx_tag_name" }} ON {{ tenant "tags" }} (Name);

CREATE TABLE IF NOT EXISTS {{ tenant "message_tags" }} (
	Key BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	ID TEXT NOT NULL,
	TagID BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS {{ tenant "idx_message_tags_id" }} ON {{ tenant "message_tags" }} (ID);
CREATE INDEX IF NOT EXISTS {{ tenant "idx_message_tags_tagid" }} ON {{ tenant "message_tags" }} (TagID);

CREATE TABLE IF NOT EXISTS {{ tenant "settings" }} (
	Key TEXT,
	Value TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS {{ tenant "idx_settings_key" }} ON {{ tenant "settings" }} (Key);

INSERT INTO {{ tenant "settings" }} (Key, Value) VALUES ('DeletedSize', '0') ON CONFLICT (Key) DO NOTHING;
