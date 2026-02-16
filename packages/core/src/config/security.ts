import { resolve, sep } from "node:path";
import { realpathSync } from "node:fs";

/**
 * Check if a candidate path is within the workspace directory.
 * Uses path.resolve() for normalization and realpathSync() for symlink detection.
 *
 * @param candidatePath - The path to check
 * @param workspaceDir - The workspace directory boundary
 * @returns true if the candidate path is within the workspace
 */
export function isPathWithinWorkspace(
	candidatePath: string,
	workspaceDir: string,
): boolean {
	const resolvedCandidate = resolve(candidatePath);
	const resolvedWorkspace = resolve(workspaceDir);

	// Check resolved path is within workspace
	if (
		resolvedCandidate !== resolvedWorkspace &&
		!resolvedCandidate.startsWith(resolvedWorkspace + sep)
	) {
		return false;
	}

	// Also check real path (resolves symlinks) to prevent symlink escapes
	try {
		const realCandidate = realpathSync(resolvedCandidate);
		const realWorkspace = realpathSync(resolvedWorkspace);
		return (
			realCandidate === realWorkspace ||
			realCandidate.startsWith(realWorkspace + sep)
		);
	} catch {
		// Path doesn't exist yet (e.g., file to be created) — allow if resolved path was OK
		return true;
	}
}
