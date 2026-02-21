/**
 * Truncate multi-line output to a maximum number of lines.
 * Appends a dimmed indicator showing how many lines were hidden.
 */
export function truncateOutput(output: string, maxLines = 20): string {
	const lines = output.split("\n");
	if (lines.length <= maxLines) {
		return output;
	}
	const remaining = lines.length - maxLines;
	return lines.slice(0, maxLines).join("\n") + `\n... (${remaining} more lines)`;
}
