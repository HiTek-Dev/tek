import chalk from "chalk";

const LOG_LINE_RE = /^(\S+) \[(INFO|WARN|ERROR)\] \[([^\]]+)\] (.+)$/;

const LEVEL_COLORS: Record<string, (s: string) => string> = {
	INFO: chalk.green,
	WARN: chalk.yellow,
	ERROR: chalk.red,
};

export function formatLogLine(line: string): string {
	const match = line.match(LOG_LINE_RE);
	if (!match) return line;

	const [, timestamp, level, logger, message] = match;

	// Extract HH:MM:SS.mmm from ISO timestamp or time string
	const timeOnly = timestamp.includes("T")
		? timestamp.split("T")[1]?.replace("Z", "") ?? timestamp
		: timestamp;

	const colorLevel = LEVEL_COLORS[level] ?? ((s: string) => s);

	return `${chalk.dim(timeOnly)} ${colorLevel(`[${level}]`)} ${chalk.cyan(`[${logger}]`)} ${message}`;
}

export function formatAndPrint(line: string): void {
	process.stdout.write(formatLogLine(line) + "\n");
}
