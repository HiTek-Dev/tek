import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

interface ModelSwitchDialogProps {
  open: boolean;
  currentModel: string;
  newModel: string;
  onConfirm: (keepContext: boolean) => void;
  onCancel: () => void;
}

export function ModelSwitchDialog({
  open,
  currentModel,
  newModel,
  onConfirm,
  onCancel,
}: ModelSwitchDialogProps) {
  const currentDisplay = currentModel.includes(":")
    ? currentModel.split(":")[1]
    : currentModel;
  const newDisplay = newModel.includes(":")
    ? newModel.split(":")[1]
    : newModel;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Switch Model</DialogTitle>
          <DialogDescription>
            How would you like to handle the conversation context?
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center gap-3 py-4">
          <span className="rounded-md bg-muted px-3 py-1.5 text-sm font-mono">
            {currentDisplay}
          </span>
          <ArrowRight className="size-4 text-muted-foreground" />
          <span className="rounded-md bg-accent px-3 py-1.5 text-sm font-mono">
            {newDisplay}
          </span>
        </div>

        <DialogFooter className="flex gap-2 sm:justify-between">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => onConfirm(false)}>
              Start Fresh
            </Button>
            <Button onClick={() => onConfirm(true)}>
              Continue with Context
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
