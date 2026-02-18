---
phase: quick-5
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/core/src/logger.ts
  - packages/core/src/config/types.ts
  - packages/core/src/config/index.ts
  - packages/core/src/index.ts
  - packages/cli/src/commands/gateway.ts
  - packages/cli/src/lib/log-formatter.ts
autonomous: true
must_haves:
  truths:
    - "Background mode writes logs to ~/.config/tek/gateway.log instead of discarding them"
    - "tek gateway logs tails the log file with color-coded output (INFO=green, WARN=yellow, ERROR=red)"
    - "tek gateway start --foreground shows formatted colored logs instead of raw stderr"
    - "Ctrl+C in foreground mode or logs mode exits cleanly"
  artifacts:
    - path: "packages/cli/src/lib/log-formatter.ts"
      provides: "Log line parser and chalk colorizer"
    - path: "packages/cli/src/commands/gateway.ts"
      provides: "Enhanced start, new logs subcommand"
    - path: "packages/core/src/config/types.ts"
      provides: "LOG_PATH constant"
  key_links:
    - from: "packages/cli/src/commands/gateway.ts"
      to: "packages/cli/src/lib/log-formatter.ts"
      via: "import formatLogLine"
      pattern: "formatLogLine"
    - from: "packages/cli/src/commands/gateway.ts"
      to: "packages/core/src/config/types.ts"
      via: "import LOG_PATH"
      pattern: "LOG_PATH"
---

<objective>
Add log persistence for background gateway mode and a formatted log viewer.

Purpose: Currently background mode discards all logs (stdio: "ignore") and foreground mode dumps raw stderr. This adds a log file for background mode, a `tek gateway logs` command to tail it with colors, and formatted output for foreground mode.

Output: Modified gateway.ts with log file redirect + logs subcommand, new log-formatter.ts utility, LOG_PATH constant in core.
</objective>

<execution_context>
@/Users/hitekmedia/.claude/get-shit-done/workflows/execute-plan.md
@/Users/hitekmedia/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@packages/cli/src/commands/gateway.ts
@packages/core/src/logger.ts
@packages/core/src/config/types.ts
@packages/core/src/config/index.ts
@packages/core/src/index.ts
@packages/cli/src/lib/discovery.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add LOG_PATH constant and log formatter utility</name>
  <files>
    packages/core/src/config/types.ts
    packages/core/src/config/index.ts
    packages/core/src/index.ts
    packages/cli/src/lib/log-formatter.ts
  </files>
  <action>
1. In `packages/core/src/config/types.ts`, add after the RUNTIME_PATH line:
   ```
   export const LOG_PATH = join(CONFIG_DIR, "gateway.log");
   ```

2. In `packages/core/src/config/index.ts`, add LOG_PATH to the re-export:
   ```
   export { CONFIG_DIR, CONFIG_PATH, DB_PATH, RUNTIME_PATH, LOG_PATH } from "./types.js";
   ```

3. In `packages/core/src/index.ts`, add LOG_PATH to the re-export from config (same line as RUNTIME_PATH).

4. Create `packages/cli/src/lib/log-formatter.ts`:
   - Export `formatLogLine(line: string): string` that parses the structured log format:
     `TIMESTAMP [LEVEL] [LOGGER] message {optional data}`
   - Use a regex: `/^(\S+) \[(INFO|WARN|ERROR)\] \[([^\]]+)\] (.+)$/`
   - Color coding with chalk:
     - INFO: chalk.green("[INFO]"), logger name in chalk.cyan
     - WARN: chalk.yellow("[WARN]"), logger name in chalk.cyan
     - ERROR: chalk.red("[ERROR]"), logger name in chalk.cyan
     - Timestamp: chalk.dim (show only HH:MM:SS.mmm, strip date portion)
     - Message: uncolored
   - If line doesn't match format, return it as-is (passthrough)
   - Export `formatAndPrint(line: string): void` that calls formatLogLine and writes to process.stdout

Example output: `10:30:45.123 [INFO] [gateway-ws] Client connected {\"id\":\"abc\"}`
with dim timestamp, green INFO, cyan logger name.
  </action>
  <verify>
    Run `cd /Users/hitekmedia/Documents/GitHub/tek && npx tsc --noEmit -p packages/core/tsconfig.json` — no errors.
    Verify LOG_PATH is exported: `grep "LOG_PATH" packages/core/src/config/types.ts packages/core/src/config/index.ts packages/core/src/index.ts`
  </verify>
  <done>LOG_PATH constant exported from @tek/core. log-formatter.ts parses structured log lines and applies chalk colors.</done>
</task>

<task type="auto">
  <name>Task 2: Enhance gateway command with log file, logs subcommand, and formatted foreground</name>
  <files>packages/cli/src/commands/gateway.ts</files>
  <action>
Modify `packages/cli/src/commands/gateway.ts`:

1. Add imports at top:
   ```
   import { openSync, createReadStream, existsSync, statSync } from "node:fs";
   import { createInterface } from "node:readline";
   import { LOG_PATH } from "@tek/core";
   import { formatLogLine } from "../lib/log-formatter.js";
   ```

2. **Background mode** — Replace `stdio: "ignore"` with log file redirect:
   ```
   const logFd = openSync(LOG_PATH, "a");
   const child = spawn(process.execPath, [entryPoint], {
     detached: true,
     stdio: ["ignore", logFd, logFd],
   });
   child.unref();
   ```
   This redirects both stdout and stderr to the log file. After `child.unref()`, close the fd in the parent process: `await import("node:fs").then(fs => fs.closeSync(logFd))` — actually simpler: just use the already-imported closeSync. Add `closeSync` to the fs import, then call `closeSync(logFd)` after `child.unref()`.

3. **Foreground mode** — Replace `stdio: "inherit"` with piped stderr formatting:
   ```
   const child = spawn(process.execPath, [entryPoint], {
     stdio: ["ignore", "inherit", "pipe"],
   });
   if (child.stderr) {
     const rl = createInterface({ input: child.stderr });
     rl.on("line", (line) => {
       console.log(formatLogLine(line));
     });
   }
   // Handle Ctrl+C gracefully
   process.on("SIGINT", () => {
     child.kill("SIGTERM");
   });
   child.on("exit", (code) => {
     process.exit(code ?? 1);
   });
   ```

4. **Add `tek gateway logs` subcommand** after the status command:
   ```
   gatewayCommand
     .command("logs")
     .description("Tail gateway logs with colored formatting")
     .option("-n, --lines <count>", "Number of recent lines to show", "20")
     .option("-f, --follow", "Follow log output (default: true)", true)
     .option("--filter <logger>", "Filter by logger name")
     .action(async (options: { lines: string; follow: boolean; filter?: string }) => {
       if (!existsSync(LOG_PATH)) {
         console.log(chalk.yellow("No log file found. Start the gateway first."));
         return;
       }

       // Read last N lines first
       const content = await import("node:fs/promises").then(fs => fs.readFile(LOG_PATH, "utf-8"));
       const allLines = content.split("\n").filter(Boolean);
       const lineCount = parseInt(options.lines, 10) || 20;
       const recentLines = allLines.slice(-lineCount);

       for (const line of recentLines) {
         if (options.filter && !line.includes(`[${options.filter}]`)) continue;
         console.log(formatLogLine(line));
       }

       if (!options.follow) return;

       // Tail the file for new lines
       console.log(chalk.dim("--- following logs (Ctrl+C to stop) ---"));

       const fileSize = statSync(LOG_PATH).size;
       let position = fileSize;

       const interval = setInterval(async () => {
         try {
           const currentSize = statSync(LOG_PATH).size;
           if (currentSize <= position) {
             if (currentSize < position) position = 0; // file truncated
             return;
           }
           const stream = createReadStream(LOG_PATH, { start: position, encoding: "utf-8" });
           let buffer = "";
           for await (const chunk of stream) {
             buffer += chunk;
           }
           position = currentSize;
           const newLines = buffer.split("\n").filter(Boolean);
           for (const line of newLines) {
             if (options.filter && !line.includes(`[${options.filter}]`)) continue;
             console.log(formatLogLine(line));
           }
         } catch {
           // file may have been removed
         }
       }, 500);

       // Clean exit on Ctrl+C
       process.on("SIGINT", () => {
         clearInterval(interval);
         process.exit(0);
       });
     });
   ```

5. **Enhance the background start success message** to mention logs:
   After printing "Gateway started on ..." add:
   ```
   console.log(chalk.dim(`  Logs: tek gateway logs`));
   ```
  </action>
  <verify>
    Run `cd /Users/hitekmedia/Documents/GitHub/tek && npx tsc --noEmit -p packages/cli/tsconfig.json` — no errors.
    Build both packages: `cd /Users/hitekmedia/Documents/GitHub/tek && npx tsc -p packages/core/tsconfig.json && npx tsc -p packages/cli/tsconfig.json` — succeeds.
  </verify>
  <done>
    Background mode writes logs to ~/.config/tek/gateway.log. Foreground mode shows chalk-formatted log lines. `tek gateway logs` tails the log file with color formatting, supports --lines, --follow, and --filter flags. Ctrl+C exits cleanly in all modes.
  </done>
</task>

</tasks>

<verification>
1. TypeScript compiles without errors for both core and cli packages
2. Background start creates/appends to ~/.config/tek/gateway.log
3. `tek gateway logs` displays recent colored log lines
4. `tek gateway logs --filter gateway-ws` shows only gateway-ws logger lines
5. Foreground mode shows formatted colored output instead of raw stderr
6. Ctrl+C in foreground and logs mode exits without error
</verification>

<success_criteria>
- Gateway logs are no longer lost in background mode (persisted to gateway.log)
- `tek gateway logs` provides a readable, color-coded view of gateway activity
- Foreground mode output is formatted with colored levels and dim timestamps
- All three modes (background start, foreground start, logs tail) handle Ctrl+C cleanly
</success_criteria>

<output>
After completion, create `.planning/quick/5-gateway-console-ui-with-live-log-streami/5-SUMMARY.md`
</output>
