import { useState, useCallback } from "react";
import {
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  XCircle,
  UserCheck,
  UserX,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useGatewayRpc } from "@/hooks/useGatewayRpc";
import {
  createTelegramUsersList,
  createTelegramUsersUpdate,
  createVaultKeysSet,
} from "@/lib/gateway-client";
import type {
  TelegramUsersListResult,
  TelegramUsersUpdateResult,
  VaultKeysSetResult,
} from "@/lib/gateway-client";

type TelegramUser = TelegramUsersListResult["users"][number];

type StatusFeedback = {
  kind: "success" | "error" | "idle";
  message: string;
};

export function TelegramSetup() {
  const { request, connected } = useGatewayRpc();

  // ── Token state ───────────────────────────────────────────────────
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [savingToken, setSavingToken] = useState(false);
  const [tokenStatus, setTokenStatus] = useState<StatusFeedback>({
    kind: "idle",
    message: "",
  });

  // ── Connection test state ─────────────────────────────────────────
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<StatusFeedback>({
    kind: "idle",
    message: "",
  });

  // ── Users state ───────────────────────────────────────────────────
  const [users, setUsers] = useState<TelegramUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [updatingUser, setUpdatingUser] = useState<number | null>(null);

  // ── Save token ────────────────────────────────────────────────────
  const handleSaveToken = useCallback(async () => {
    if (!token.trim() || !connected) return;
    setSavingToken(true);
    setTokenStatus({ kind: "idle", message: "" });
    try {
      const res = await request<VaultKeysSetResult>(
        createVaultKeysSet("telegram", token.trim()),
      );
      if (res.success) {
        setTokenStatus({ kind: "success", message: "Token saved" });
        setToken("");
      } else {
        setTokenStatus({
          kind: "error",
          message: res.error ?? "Failed to save token",
        });
      }
    } catch (err) {
      setTokenStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Request failed",
      });
    } finally {
      setSavingToken(false);
    }
  }, [token, connected, request]);

  // ── Test connection ───────────────────────────────────────────────
  const handleTestConnection = useCallback(async () => {
    if (!connected) return;
    setTestingConnection(true);
    setConnectionStatus({ kind: "idle", message: "" });
    try {
      const res = await request<TelegramUsersListResult>(
        createTelegramUsersList(),
      );
      if (res.type === "telegram.users.list.result") {
        setConnectionStatus({
          kind: "success",
          message: `Connected — ${res.users.length} user(s) found`,
        });
        setUsers(res.users);
      }
    } catch (err) {
      setConnectionStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Connection test failed",
      });
    } finally {
      setTestingConnection(false);
    }
  }, [connected, request]);

  // ── Fetch users ───────────────────────────────────────────────────
  const handleFetchUsers = useCallback(async () => {
    if (!connected) return;
    setLoadingUsers(true);
    try {
      const res = await request<TelegramUsersListResult>(
        createTelegramUsersList(),
      );
      if (res.type === "telegram.users.list.result") {
        setUsers(res.users);
      }
    } catch {
      // silent
    } finally {
      setLoadingUsers(false);
    }
  }, [connected, request]);

  // ── Update user approval ──────────────────────────────────────────
  const handleUserUpdate = useCallback(
    async (chatId: number, approved: boolean) => {
      if (!connected) return;
      setUpdatingUser(chatId);
      try {
        const res = await request<TelegramUsersUpdateResult>(
          createTelegramUsersUpdate(chatId, approved),
        );
        if (res.success) {
          setUsers((prev) =>
            prev.map((u) =>
              u.telegramChatId === chatId ? { ...u, approved } : u,
            ),
          );
        }
      } catch {
        // silent
      } finally {
        setUpdatingUser(null);
      }
    },
    [connected, request],
  );

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6">
      {/* Bot Token Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bot Token</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <input
                type={showToken ? "text" : "password"}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Enter Telegram bot token..."
                className="h-9 w-full rounded-md border border-input bg-background px-3 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showToken ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
            <Button
              size="sm"
              onClick={handleSaveToken}
              disabled={!token.trim() || savingToken || !connected}
            >
              {savingToken && <Loader2 className="size-4 animate-spin" />}
              Save Token
            </Button>
          </div>

          {tokenStatus.kind !== "idle" && (
            <div
              className={`flex items-center gap-2 text-sm ${
                tokenStatus.kind === "success"
                  ? "text-green-400"
                  : "text-red-400"
              }`}
            >
              {tokenStatus.kind === "success" ? (
                <CheckCircle2 className="size-4" />
              ) : (
                <XCircle className="size-4" />
              )}
              {tokenStatus.message}
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={testingConnection || !connected}
            >
              {testingConnection && (
                <Loader2 className="size-4 animate-spin" />
              )}
              Test Connection
            </Button>
            {connectionStatus.kind !== "idle" && (
              <span
                className={`text-sm ${
                  connectionStatus.kind === "success"
                    ? "text-green-400"
                    : "text-red-400"
                }`}
              >
                {connectionStatus.message}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* User Whitelist */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">User Whitelist</CardTitle>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleFetchUsers}
            disabled={loadingUsers || !connected}
          >
            <RefreshCw
              className={`size-4 ${loadingUsers ? "animate-spin" : ""}`}
            />
          </Button>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No users found. Save a bot token and test the connection to load
              users, or have a user pair with the bot on Telegram first.
            </p>
          ) : (
            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                      Username
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                      User ID
                    </th>
                    <th className="px-4 py-2 text-center font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr
                      key={user.telegramChatId}
                      className="border-b border-border last:border-b-0"
                    >
                      <td className="px-4 py-2 text-foreground">
                        {user.telegramUsername ? (
                          `@${user.telegramUsername}`
                        ) : (
                          <span className="text-muted-foreground italic">
                            No username
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                        {user.telegramUserId}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <Badge
                          variant={user.approved ? "default" : "outline"}
                          className={
                            user.approved
                              ? "bg-green-600 text-white"
                              : "text-muted-foreground"
                          }
                        >
                          {user.approved ? "Approved" : "Pending"}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!user.approved && (
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() =>
                                handleUserUpdate(user.telegramChatId, true)
                              }
                              disabled={
                                updatingUser === user.telegramChatId ||
                                !connected
                              }
                              className="text-green-400 hover:text-green-300"
                            >
                              {updatingUser === user.telegramChatId ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                <UserCheck className="size-3" />
                              )}
                              Approve
                            </Button>
                          )}
                          {user.approved && (
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() =>
                                handleUserUpdate(user.telegramChatId, false)
                              }
                              disabled={
                                updatingUser === user.telegramChatId ||
                                !connected
                              }
                              className="text-red-400 hover:text-red-300"
                            >
                              {updatingUser === user.telegramChatId ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                <UserX className="size-3" />
                              )}
                              Deny
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
