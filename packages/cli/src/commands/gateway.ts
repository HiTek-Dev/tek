import { Command } from "commander";
import { spawn } from "node:child_process";
import { realpathSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { homedir } from "node:os";
import chalk from "chalk";
import { discoverGateway } from "../lib/discovery.js";

function getInstallDir(): string {
	try {
		const realBin = realpathSync(process.argv[1]);
		// realBin is e.g. <installDir>/packages/cli/dist/index.js
		return resolve(dirname(realBin), "..", "..", "..");
	} catch {
		return resolve(homedir(), "tek");
	}
}

export const gatewayCommand = new Command("gateway").description(
	"Manage the Tek gateway process",
);

gatewayCommand
	.command("start")
	.description("Start the gateway")
	.option("--foreground", "Run in the foreground instead of background")
	.action(async (options: { foreground?: boolean }) => {
		const existing = discoverGateway();
		if (existing) {
			console.log(
				chalk.yellow(
					`Gateway already running on 127.0.0.1:${existing.port} (PID ${existing.pid})`,
				),
			);
			return;
		}

		const installDir = getInstallDir();
		const entryPoint = resolve(
			installDir,
			"packages",
			"gateway",
			"dist",
			"index.js",
		);

		if (options.foreground) {
			const child = spawn(process.execPath, [entryPoint], {
				stdio: "inherit",
			});
			child.on("exit", (code) => {
				process.exit(code ?? 1);
			});
			return;
		}

		// Background mode
		const child = spawn(process.execPath, [entryPoint], {
			detached: true,
			stdio: "ignore",
		});
		child.unref();

		// Poll for gateway to become available
		const maxWait = 10_000;
		const interval = 250;
		const start = Date.now();

		while (Date.now() - start < maxWait) {
			await new Promise((r) => setTimeout(r, interval));
			const info = discoverGateway();
			if (info) {
				console.log(
					chalk.green(
						`Gateway started on 127.0.0.1:${info.port} (PID ${info.pid})`,
					),
				);
				return;
			}
		}

		console.log(
			chalk.red(
				"Gateway did not start within 10 seconds. Check logs for errors.",
			),
		);
		process.exit(1);
	});

gatewayCommand
	.command("stop")
	.description("Stop the running gateway")
	.action(async () => {
		const info = discoverGateway();
		if (!info) {
			console.log(chalk.yellow("Gateway is not running."));
			return;
		}

		try {
			process.kill(info.pid, "SIGTERM");
		} catch {
			console.log(chalk.yellow("Gateway is not running."));
			return;
		}

		// Wait up to 5 seconds for process to die
		const maxWait = 5_000;
		const interval = 250;
		const start = Date.now();

		while (Date.now() - start < maxWait) {
			await new Promise((r) => setTimeout(r, interval));
			try {
				process.kill(info.pid, 0);
			} catch {
				// Process is gone
				console.log(chalk.green("Gateway stopped."));
				return;
			}
		}

		console.log(chalk.red("Failed to stop gateway."));
		process.exit(1);
	});

gatewayCommand
	.command("status")
	.description("Check if the gateway is running")
	.action(() => {
		const info = discoverGateway();
		if (info) {
			console.log(
				chalk.green(
					`Gateway is running on 127.0.0.1:${info.port} (PID ${info.pid})`,
				),
			);
		} else {
			console.log(chalk.yellow("Gateway is not running."));
		}
	});
