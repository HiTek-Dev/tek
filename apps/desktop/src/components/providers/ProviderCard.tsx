import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const PROVIDER_ICONS: Record<string, string> = {
  anthropic: "\u{1F9E0}",
  openai: "\u{1F916}",
  google: "\u{1F48E}",
  venice: "\u{1F3AD}",
  ollama: "\u{1F999}",
};

interface ProviderCardProps {
  name: string;
  provider: string;
  configured: boolean;
  active: boolean;
  onClick: () => void;
}

export function ProviderCard({
  name,
  provider,
  configured,
  active,
  onClick,
}: ProviderCardProps) {
  const icon = PROVIDER_ICONS[provider] ?? "\u{1F50C}";

  return (
    <Card
      className={cn(
        "cursor-pointer transition-colors hover:border-primary",
        active && "ring-2 ring-primary",
      )}
      onClick={onClick}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <span className="text-2xl" role="img" aria-label={provider}>
            {icon}
          </span>
          <span>{name}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {configured ? (
          <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-600/30">
            Configured
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-muted-foreground">
            Not configured
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
