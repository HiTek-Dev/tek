import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { LogEntry } from "@/stores/process-store";

interface LiveLogProps {
  logs: LogEntry[];
  maxHeight?: string;
}

const levelColors: Record<string, string> = {
  info: "text-muted-foreground",
  warn: "text-yellow-500",
  error: "text-red-400",
  debug: "text-blue-400",
};

export function LiveLog({ logs, maxHeight = "300px" }: LiveLogProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const nearBottom = scrollHeight - scrollTop - clientHeight < 40;
    setAutoScroll(nearBottom);
  };

  const filtered = filter
    ? logs.filter((l) => l.message.toLowerCase().includes(filter.toLowerCase()))
    : logs;

  return (
    <div className="flex flex-col gap-1">
      <input
        type="text"
        placeholder="Filter logs..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="w-full rounded-md border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="overflow-y-auto rounded-md bg-muted/50 p-2 font-mono text-[11px]"
        style={{ maxHeight }}
      >
        {filtered.length === 0 && (
          <span className="text-muted-foreground">No logs yet</span>
        )}
        {filtered.map((log, i) => (
          <div key={i} className="flex gap-2 leading-relaxed">
            <span className="shrink-0 text-muted-foreground/60">
              {new Date(log.timestamp).toLocaleTimeString()}
            </span>
            {log.module && (
              <span className="shrink-0 text-muted-foreground/80">[{log.module}]</span>
            )}
            <span className={cn(levelColors[log.level] ?? "text-foreground")}>
              {log.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
