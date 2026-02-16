import { Command } from "commander";
import chalk from "chalk";
import { getAuditEvents } from "@agentspace/db";

export const auditCommand = new Command("audit")
	.description("View audit log")
	.option("-l, --limit <n>", "Number of entries to show", "20")
	.option("-p, --provider <name>", "Filter by provider")
	.option("--json", "Output as JSON")
	.action(
		(options: { limit: string; provider?: string; json?: boolean }) => {
			const limit = parseInt(options.limit, 10);
			if (isNaN(limit) || limit < 1) {
				console.log(chalk.red("Error: --limit must be a positive number"));
				return;
			}

			const events = getAuditEvents({
				limit,
				provider: options.provider,
			});

			if (events.length === 0) {
				console.log(chalk.dim("No audit events found."));
				return;
			}

			if (options.json) {
				console.log(JSON.stringify(events, null, 2));
				return;
			}

			// Table format
			const header = `  ${chalk.bold("Timestamp".padEnd(24))} ${chalk.bold("Event".padEnd(16))} ${chalk.bold("Provider".padEnd(12))} ${chalk.bold("Source")}`;
			console.log(`\n${chalk.bold("Audit Log")}\n`);
			console.log(header);
			console.log("  " + "-".repeat(70));

			for (const event of events) {
				const ts = event.timestamp
					? event.timestamp.slice(0, 23).padEnd(24)
					: "".padEnd(24);
				const evt = (event.event ?? "").padEnd(16);
				const provider = (event.provider ?? "-").padEnd(12);
				const source = event.sourceIp ?? "-";

				let color = chalk.white;
				if (event.event === "key_accessed") color = chalk.cyan;
				if (event.event === "key_added") color = chalk.green;
				if (event.event === "key_removed") color = chalk.red;
				if (event.event === "key_updated") color = chalk.yellow;
				if (event.event === "mode_changed") color = chalk.magenta;

				console.log(`  ${chalk.dim(ts)} ${color(evt)} ${provider} ${source}`);
			}
			console.log();
		},
	);
