import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ToolApprovalModalProps {
  toolName: string;
  toolCallId: string;
  args: unknown;
  risk?: string;
  onApprove: (toolCallId: string, sessionApprove: boolean) => void;
  onDeny: (toolCallId: string) => void;
  open: boolean;
}

export function ToolApprovalModal({
  toolName,
  toolCallId,
  args,
  risk,
  onApprove,
  onDeny,
  open,
}: ToolApprovalModalProps) {
  const showRiskBadge = risk === "medium" || risk === "high";

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Tool Approval Required</DialogTitle>
          <DialogDescription>
            The agent wants to execute a tool. Review the details and choose an
            action.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Tool name + risk badge */}
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold">{toolName}</span>
            {showRiskBadge && (
              <Badge
                variant={risk === "high" ? "destructive" : "outline"}
                className={
                  risk === "medium"
                    ? "border-yellow-500 text-yellow-500"
                    : undefined
                }
              >
                {risk} risk
              </Badge>
            )}
          </div>

          {/* Arguments preview */}
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              Arguments
            </p>
            <pre className="max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs">
              {JSON.stringify(args, null, 2)}
            </pre>
          </div>
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <Button variant="outline" onClick={() => onDeny(toolCallId)}>
            Deny
          </Button>
          <div className="flex gap-2">
            <Button onClick={() => onApprove(toolCallId, false)}>
              Approve Once
            </Button>
            <Button onClick={() => onApprove(toolCallId, true)}>
              Approve for Session
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
