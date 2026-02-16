import { marked } from "marked";
import { markedTerminal } from "marked-terminal";

// Configure marked with terminal renderer for CLI markdown display
marked.use(
	markedTerminal({
		width: process.stdout.columns || 80,
		tab: 2,
		reflowText: true,
	}),
);

/**
 * Render markdown text to terminal-formatted string with syntax highlighting.
 * Returns empty/whitespace input as-is.
 */
export function renderMarkdown(text: string): string {
	if (!text || !text.trim()) {
		return text;
	}
	const result = marked.parse(text);
	// marked.parse can return string | Promise<string>; our config is synchronous
	if (typeof result === "string") {
		// Trim trailing newline that marked adds
		return result.replace(/\n$/, "");
	}
	return text;
}
