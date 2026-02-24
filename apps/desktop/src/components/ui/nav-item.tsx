import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItemProps {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
  statusDot?: "green" | "red" | "gray";
  disabled?: boolean;
  tooltip?: string;
}

export function NavItem({ icon: Icon, label, active, onClick, statusDot, disabled, tooltip }: NavItemProps) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={tooltip}
      className={cn(
        "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        disabled
          ? "cursor-not-allowed opacity-40 text-muted-foreground"
          : active
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="truncate">{label}</span>
      {statusDot && (
        <span
          className={cn(
            "ml-auto size-2 shrink-0 rounded-full",
            statusDot === "green" && "bg-green-500",
            statusDot === "red" && "bg-red-500",
            statusDot === "gray" && "bg-gray-400 animate-pulse",
          )}
        />
      )}
    </button>
  );
}
