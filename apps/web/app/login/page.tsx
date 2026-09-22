"use client";

import { useState } from "react";
import { Radio, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  return (
    <div className="grid min-h-dvh place-items-center p-6">
      {/* faint instrument grid backdrop */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 40%, black, transparent)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 40%, black, transparent)",
        }}
        aria-hidden
      />

      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-md bg-accent text-accent-fg">
            <Radio className="size-5" aria-hidden />
          </span>
          <span className="text-xl font-semibold tracking-[-0.02em]">Fauxbox</span>
        </div>

        <div className="rounded-lg border border-border bg-surface p-6 shadow-e2">
          <h1 className="text-lg font-semibold tracking-[-0.01em]">Sign in</h1>
          <p className="mt-1 text-sm text-muted">
            Access your email capture sandboxes.
          </p>

          <form
            className="mt-5 flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              setLoading(true);
              setTimeout(() => setLoading(false), 900);
            }}
          >
            <Field label="Email" htmlFor="email">
              <Input id="email" type="email" autoComplete="email" placeholder="you@company.com" required />
            </Field>
            <Field label="Password" htmlFor="password">
              <Input id="password" type="password" autoComplete="current-password" placeholder="••••••••" required />
            </Field>
            <Button type="submit" size="lg" loading={loading} className="mt-1 w-full">
              Sign in
              {!loading && <ArrowRight className="size-4" aria-hidden />}
            </Button>
          </form>
        </div>

        <p className="mt-4 text-center font-mono text-2xs text-faint">
          multi-tenant · rls-isolated · single deployment
        </p>
      </div>
    </div>
  );
}
