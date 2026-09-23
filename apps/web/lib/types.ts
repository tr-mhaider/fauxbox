// TypeScript mirrors of the Go API JSON. Message fields use the API's
// PascalCase keys (storage.MessageSummary / storage.Message marshal field names
// directly); the sandbox endpoint uses snake_case json tags.

export interface Address {
  Name?: string;
  Address: string;
}

export interface MessageSummary {
  ID: string;
  MessageID: string;
  Read: boolean;
  From: Address | null;
  To: Address[] | null;
  Cc: Address[] | null;
  Bcc: Address[] | null;
  ReplyTo: Address[] | null;
  Subject: string;
  Created: string; // RFC3339
  Username: string;
  Tags: string[] | null;
  Size: number;
  Attachments: number;
  Snippet: string;
}

export interface MessagesResult {
  total: number;
  unread: number;
  count: number;
  messages_count: number;
  messages_unread: number;
  start: number;
  tags: string[];
  messages: MessageSummary[];
}

export interface Attachment {
  PartID: string;
  FileName: string;
  ContentType: string;
  ContentID: string;
  Size: number;
}

export interface Message {
  ID: string;
  MessageID: string;
  From: Address | null;
  To: Address[] | null;
  Cc: Address[] | null;
  Bcc: Address[] | null;
  ReplyTo: Address[] | null;
  ReturnPath: string;
  Subject: string;
  Date: string;
  Tags: string[] | null;
  Text: string;
  HTML: string;
  Size: number;
  Inline: Attachment[] | null;
  Attachments: Attachment[] | null;
}

export interface AccountUser {
  id: string;
  email: string;
  role: string;
}

export interface APIToken {
  ID: string;
  Scopes: string;
  Created: number;
}

export interface Sandbox {
  id: string;
  subdomain: string;
  smtp_username: string;
  max_messages: number;
  max_message_size: number;
  retention_hours: number;
  rate_limit: number;
  webhook_url: string;
}

export interface LoginResult {
  account_id: string;
  csrf_token: string;
}

export interface WebUIConfig {
  Label: string;
  MessageRelay: {
    Enabled: boolean;
    SMTPServer: string;
    ReturnPath: string;
    AllowedRecipients: string;
    BlockedRecipients: string;
    OverrideFrom: string;
    PreserveMessageIDs: boolean;
  };
  SpamAssassin: boolean;
  ChaosEnabled: boolean;
  DuplicatesIgnored: boolean;
  HideDeleteAllButton: boolean;
}

export interface HTMLCheckResponse {
  Warnings: {
    Slug: string;
    Title: string;
    Description: string;
    URL: string;
    Category: string;
    Score: { Found: number; Supported: number; Partial: number; Unsupported: number };
  }[];
  Total: { Tests: number; Nodes: number; Supported: number; Partial: number; Unsupported: number };
}

export interface LinkCheckResponse {
  Errors: number;
  Links: { URL: string; StatusCode: number; Status: string }[];
}

export interface SpamResult {
  IsSpam: boolean;
  Error: string;
  Score: number;
  Rules: { Score: number; Name: string; Description: string }[] | null;
}

export interface AppInfo {
  Version: string;
  LatestVersion: string;
  Database: string;
  DatabaseSize: number;
  Messages: number;
  RuntimeStats: {
    Memory: number;
    Uptime: number;
    MessagesDeleted: number;
    SMTPAccepted: number;
    SMTPAcceptedSize: number;
    SMTPRejected: number;
    SMTPIgnored: number;
  };
}

// Websocket broadcast envelope (server/websockets.WebsocketNotification).
export interface WSNotification {
  Type: "new" | "update" | "delete" | "prune" | "truncate" | "stats" | "error";
  Data: unknown;
}
