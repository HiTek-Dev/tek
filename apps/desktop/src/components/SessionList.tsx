import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";

export interface SessionSummary {
  sessionId: string;
  sessionKey: string;
  model: string;
  createdAt: string;
  messageCount: number;
}

interface SessionListProps {
  sessions: SessionSummary[];
  currentSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;

  return new Date(dateStr).toLocaleDateString();
}

function truncateSessionKey(sessionKey: string, sessionId: string): string {
  if (sessionKey && sessionKey.length > 0) {
    return sessionKey.length > 28 ? sessionKey.slice(0, 28) + "..." : sessionKey;
  }
  return "Session " + sessionId.slice(-4);
}

export function SessionList({
  sessions,
  currentSessionId,
  onSelectSession,
}: SessionListProps) {
  return (
    <div className="flex h-full flex-col">
      {/* New Chat button */}
      <div className="p-2">
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={() => onSelectSession("")}
        >
          <Plus className="size-4" />
          New Chat
        </Button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-auto px-2 pb-2">
        {sessions.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">
            No previous sessions
          </p>
        ) : (
          <div className="space-y-1">
            {sessions.map((session) => {
              const isCurrent = session.sessionId === currentSessionId;
              return (
                <Card
                  key={session.sessionId}
                  className={cn(
                    "cursor-pointer transition-colors hover:bg-accent/50 py-1",
                    isCurrent && "border-primary bg-accent/30",
                  )}
                  onClick={() => onSelectSession(session.sessionId)}
                >
                  <CardContent className="p-2.5">
                    <p className="truncate text-xs font-medium">
                      {truncateSessionKey(session.sessionKey, session.sessionId)}
                    </p>
                    <div className="mt-1 flex items-center justify-between gap-1">
                      <Badge variant="secondary" className="text-[9px] px-1 py-0">
                        {session.model}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {session.messageCount} msgs
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {formatRelativeTime(session.createdAt)}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
