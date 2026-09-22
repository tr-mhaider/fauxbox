import { cn } from "@/lib/cn";

// Key/value table for machine data (headers, MIME parts). Keys are mono+muted,
// values mono+fg, aligned with tabular numerals.
interface KVProps {
  rows: { key: string; value: React.ReactNode }[];
  className?: string;
}

export function KeyValueTable({ rows, className }: KVProps) {
  return (
    <div className={cn("overflow-hidden rounded-md border border-border", className)}>
      <table className="w-full border-collapse text-sm">
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={r.key + i}
              className="border-b border-border last:border-0 hover:bg-surface-2"
            >
              <td className="w-52 max-w-52 whitespace-nowrap border-r border-border bg-surface-2/50 px-3 py-1.5 align-top font-mono text-xs text-muted">
                {r.key}
              </td>
              <td className="break-all px-3 py-1.5 align-top font-mono text-xs text-fg tabular">
                {r.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
