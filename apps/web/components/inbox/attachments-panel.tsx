"use client";

import { useEffect, useState } from "react";
import { Download, FileText, ImageIcon } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { formatSize } from "@/lib/view-model";
import type { Attachment } from "@/lib/types";

function isImage(ct: string) {
  return ct.toLowerCase().startsWith("image/");
}

// Fetches its own thumbnail blob and cleans up the object URL on unmount.
function Thumb({ sandbox, id, partID }: { sandbox: string; id: string; partID: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let obj: string | null = null;
    let cancelled = false;
    const ctrl = new AbortController();
    api
      .fetchPart(sandbox, id, partID, true, ctrl.signal)
      .then((blob) => {
        if (cancelled) return;
        obj = URL.createObjectURL(blob);
        setUrl(obj);
      })
      .catch(() => {
        // no thumbnail; the icon fallback stands in
      });
    return () => {
      cancelled = true;
      ctrl.abort();
      if (obj) URL.revokeObjectURL(obj);
    };
  }, [sandbox, id, partID]);

  if (!url) {
    return (
      <span className="grid size-10 shrink-0 place-items-center rounded border border-border bg-surface-2 text-faint">
        <ImageIcon className="size-4" aria-hidden />
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="size-10 shrink-0 rounded border border-border object-cover" />;
}

export function AttachmentsPanel({
  sandbox,
  id,
  attachments,
  inline,
}: {
  sandbox: string;
  id: string;
  attachments: Attachment[];
  inline: Attachment[];
}) {
  const { notify } = useToast();

  const rows = [
    ...attachments.map((a) => ({ att: a, inline: false })),
    ...inline.map((a) => ({ att: a, inline: true })),
  ];

  async function download(att: Attachment) {
    try {
      const blob = await api.fetchPart(sandbox, id, att.PartID);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = att.FileName || att.PartID;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Download failed", "error");
    }
  }

  if (rows.length === 0) {
    return <p className="text-sm text-muted">No attachments.</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
      {rows.map(({ att, inline: isInline }) => (
        <li key={att.PartID} className="flex items-center gap-3 px-4 py-2.5">
          {isImage(att.ContentType) ? (
            <Thumb sandbox={sandbox} id={id} partID={att.PartID} />
          ) : (
            <span className="grid size-10 shrink-0 place-items-center rounded border border-border bg-surface-2 text-faint">
              <FileText className="size-4" aria-hidden />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 truncate text-sm text-fg">
              {att.FileName || att.PartID}
              {isInline && <span className="font-mono text-2xs text-faint">inline</span>}
            </p>
            <p className="truncate font-mono text-2xs text-faint">
              {att.ContentType} · {formatSize(att.Size)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => download(att)}
            aria-label={`Download ${att.FileName || att.PartID}`}
            className="grid size-8 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <Download className="size-4" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}
