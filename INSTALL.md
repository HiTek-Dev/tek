# Tek -- Install & Update Procedure

## Prerequisites

- **Node.js >= 22** (`node -v` to check)
- **pnpm 9.x** (`npm install -g pnpm`)
- **Git** (for cloning the source repo)
- **API key** for at least one LLM provider (Anthropic recommended)

## 1. Fresh Install

### Clone the source repo

```bash
git clone https://github.com/HiTek-Dev/tek.git
cd tek
```

### Run the install script

```bash
scripts/install.sh ~/tek
```

This builds from source and deploys to `~/tek`. You can specify any directory.

**What the script does:**

1. Checks Node.js >= 22 and pnpm are available
2. Runs `pnpm install` in the source repo
3. Builds all 5 packages with a two-pass strategy (gateway pass 1 -> cli -> gateway pass 2) to resolve the cli<->gateway cyclic dependency
4. Creates the install directory and rsyncs built artifacts (no source files, no dev configs)
5. Copies root node_modules and per-package node_modules (native modules like better-sqlite3 work at the target)
6. Migrates config from `~/.config/agentspace/` to `~/.config/tek/` if upgrading from a previous version
7. Seeds default personality (`SOUL.md`) and memory (`MEMORY.md`) to `~/.config/tek/memory/` if not already present
8. Creates a `bin/tek` symlink
9. Writes a `.version` file with commit hash and timestamps

### Add to your PATH

Add the following line to your shell profile so the `tek` command is available in every new terminal:

**For zsh (default on macOS):**

```bash
echo 'export PATH="$HOME/tek/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

**For bash:**

```bash
echo 'export PATH="$HOME/tek/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

To verify it worked, open a **new** terminal and run:

```bash
which tek
# Should output: /Users/<you>/tek/bin/tek
```

If you installed to a custom directory, replace `$HOME/tek` with your install path.

### Run onboarding

```bash
tek init
```

This walks you through:

1. Choosing a security mode (Full Control or Limited Control)
2. Adding API keys (stored in macOS Keychain, not on disk)
3. Creating `~/.config/tek/config.json`
4. Generating an auth token

### Start the gateway

```bash
# Terminal 1:
node ~/tek/packages/gateway/dist/index.js
# You should see: gateway listening on 127.0.0.1:3271
```

### Start chatting

```bash
# Terminal 2:
tek chat
```

## 2. Updating

When you've pulled new changes to the source repo:

```bash
cd tek
git pull
scripts/update.sh ~/tek
```

**What the script does:**

1. Checks the install directory exists (errors if not -- run install.sh first)
2. Stops the gateway if it's running (reads PID from `~/.config/tek/runtime.json`)
3. Runs `pnpm install` and rebuilds all packages from source
4. Rsyncs updated built artifacts to the install directory
5. Syncs node_modules (picks up new/updated dependencies)
6. Updates `.version` file (preserves original `installedAt` date, updates `updatedAt`)

**What it does NOT touch:**

- `~/.config/tek/config.json` (your settings)
- `~/.config/tek/tek.db` (your conversations, threads, memories)
- `~/.config/tek/memory/` (SOUL.md, MEMORY.md, daily logs)
- macOS Keychain entries (API keys)

After updating, restart the gateway:

```bash
node ~/tek/packages/gateway/dist/index.js
```

## 3. Fresh Start (Reset)

To wipe all user data and start from scratch:

```bash
scripts/reset.sh
```

**What it does:**

1. Shows a warning listing everything that will be deleted
2. Requires you to type `RESET` to confirm (any other input cancels)
3. Stops the gateway if running
4. Removes the entire `~/.config/tek/` directory

**What it does NOT remove:**

- The installed code (`~/tek/` stays intact)
- API keys in macOS Keychain (remove manually with `tek keys remove <provider>`)

After resetting, run onboarding again: `tek init`

## 4. Uninstalling

Tek runs as a foreground process only -- no LaunchAgents, system services, or cron jobs are installed.

To fully uninstall:

1. Delete the install directory: `rm -rf ~/tek` (or wherever you installed)
2. Delete config/data: `rm -rf ~/.config/tek`
3. Remove from PATH (edit `~/.zshrc` or `~/.bashrc`)
4. (Optional) Remove API keys from Keychain: `tek keys remove <provider>` before deleting, or use Keychain Access.app to find entries with service "tek"

Deleting the install directory immediately stops all functionality. There are no background processes to clean up.

## File Locations

| What             | Where                                                  |
| ---------------- | ------------------------------------------------------ |
| Installed code   | `~/tek/` (or your chosen directory)                    |
| Config file      | `~/.config/tek/config.json`                            |
| SQLite database  | `~/.config/tek/tek.db`                                 |
| Personality      | `~/.config/tek/memory/SOUL.md`                         |
| Long-term memory | `~/.config/tek/memory/MEMORY.md`                       |
| Daily logs       | `~/.config/tek/memory/daily/`                          |
| Runtime info     | `~/.config/tek/runtime.json` (only while gateway runs) |
| API keys         | macOS Keychain (service: `tek`)                        |
| Version info     | `~/tek/.version`                                       |
| CLI binary       | `~/tek/bin/tek`                                        |

## Telegram Setup (Optional)

1. Create a bot via [@BotFather](https://t.me/BotFather) on Telegram
2. Add the bot token to your config:
   ```bash
   # Edit ~/.config/tek/config.json, add:
   # "telegram": { "botToken": "YOUR_BOT_TOKEN" }
   ```
3. Start the Telegram service:
   ```bash
   node ~/tek/packages/telegram/dist/index.js
   ```
4. In Telegram, send `/start` to your bot, then `/pair`
5. Enter the pairing code shown

## Troubleshooting

**Build fails with turbo errors:**
The install/update scripts build packages individually with `npx tsc` to avoid a known turbo issue with the cli/gateway cyclic workspace dependency. If you see turbo-related errors during manual builds, use the scripts instead.

**sqlite-vec or better-sqlite3 issues:**
These are native modules compiled for your platform. The install script copies the pre-built binaries from the source repo's node_modules. If you change Node.js versions, re-run the install or update script to rebuild.

**Gateway won't start after update:**
Check that the update script ran successfully. Look for errors in the build output. Try `node ~/tek/packages/gateway/dist/index.js 2>&1` to see startup errors.

**Memory files not found:**
On first run after the Phase 11 update, memory files auto-migrate from the old location (inside the package tree) to `~/.config/tek/memory/`. If you see a migration notice on stderr, this is expected and only happens once.
