# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js (App Router, TypeScript) with Tailwind CSS, consuming a headless Go API over HTTPS + websockets. Decided earlier in the multi-tenant build (see the implementation work plan); the dashboard lives in `apps/web`.

## Users

Developers and development teams who need to see the email their applications send while working in dev, staging, and QA. Primary situation: an engineer points their app's SMTP at a Fauxbox sandbox, triggers a flow (signup, password reset, receipt), and needs to inspect exactly what was sent — quickly, many times a day, often side by side with their code.

## Product Purpose

Capture outbound email from applications under test and make it fast and pleasant to inspect and validate, without ever delivering to real people. Success is an engineer confirming "the email is correct" (content, HTML rendering, links, headers, spam score) in seconds, and teams trusting that each project's mail is fully isolated.

## Positioning

A single, horizontally scalable deployment serving many isolated sandboxes with database-enforced tenant isolation (PostgreSQL Row-Level Security), per-sandbox SMTP credentials, and per-plan limits — the Mailtrap/Mailosaur category executed with real multi-tenant isolation and best-in-class inspection ergonomics. The differentiator is airtight isolation plus developer-grade speed and craft, not feature count.

## Operating Context

Engineers configure their app's SMTP with a sandbox's credentials, or send via the API. They then: browse the inbox (newest first, live-updating), open a message and switch between formatted HTML, HTML source, plain text, headers, raw source, and attachments; run HTML-compatibility, link, and spam checks; search with a filter syntax (to/from/subject/tag/is/has/dates/sizes); tag and organize; and optionally release/relay a message onward. Teams manage members and API tokens per account; each account owns multiple sandboxes.

## Capabilities and Constraints

- SMTP capture, REST API, POP3, websocket live updates.
- Multi-tenant: account -> users + sandboxes; sandbox is the isolation unit (RLS-enforced).
- Auth: httpOnly session cookies + CSRF for the dashboard; bearer JWT / hashed API tokens for programmatic + Send API. Sandbox selected via `X-Sandbox-ID` header (single app origin); mail domains use per-sandbox subdomains.
- Per-sandbox and per-account limits (message count, storage, retention, size).
- Message content may include real test data; the UI must render untrusted HTML safely (sandboxed frame).
- Undecided: exact plan tiers/pricing (not to be fabricated).

## Brand Commitments

- Name: **Fauxbox**.
- Voice/personality: precise, technical, and understated, with quiet modern confidence — trust earned through restraint and craft (the register of a well-made developer instrument), not hype or gamification. Greenfield identity otherwise (no existing logo, colors, or fonts to match).

## Evidence on Hand

Greenfield. No real customers, testimonials, benchmarks, prices, or press exist yet; any such content in the UI must be clearly synthetic/sample data and listed for replacement. Sample emails and sandbox names may be authored as demonstration data.

## Product Principles

1. Isolation is sacred — nothing in the UI may imply or allow cross-sandbox visibility.
2. Developer-first ergonomics — keyboard-friendly, fast, scannable; monospace where developers read machine data (addresses, headers, source).
3. Inspection is the product — the message viewer and its fidelity are the center of gravity.
4. Speed and clarity over decoration — every element earns its place; the craft is in precision.
5. Honest content — demonstration data is labeled; claims are never fabricated.

## Accessibility & Inclusion

Target WCAG 2.2 AA: 4.5:1 text contrast in both themes, visible keyboard focus, respect for prefers-reduced-motion, and no meaning conveyed by color alone.
