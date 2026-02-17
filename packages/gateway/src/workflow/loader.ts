import { readFileSync, readdirSync } from "node:fs";
import { join, extname, basename } from "node:path";
import { parse } from "yaml";
import { createLogger } from "@agentspace/core";
import {
	WorkflowDefinitionSchema,
	type WorkflowDefinition,
} from "./types.js";

const logger = createLogger("workflow-loader");

/**
 * Load a workflow definition from a YAML or TypeScript file.
 *
 * - .yaml / .yml: parsed with yaml library, validated against schema
 * - .ts / .workflow.ts: dynamic import, access .default export, validate
 */
export async function loadWorkflowDefinition(
	filePath: string,
): Promise<WorkflowDefinition> {
	const ext = extname(filePath).toLowerCase();

	if (ext === ".yaml" || ext === ".yml") {
		const raw = readFileSync(filePath, "utf-8");
		const parsed = parse(raw);
		return WorkflowDefinitionSchema.parse(parsed);
	}

	if (ext === ".ts" || filePath.endsWith(".workflow.ts")) {
		const module = await import(filePath);
		const def = module.default;
		if (!def) {
			throw new Error(
				`Workflow file ${filePath} does not have a default export`,
			);
		}
		return WorkflowDefinitionSchema.parse(def);
	}

	throw new Error(
		`Unsupported workflow file extension: ${ext} (expected .yaml, .yml, or .ts)`,
	);
}

/**
 * Discover workflow files in the given directories.
 *
 * Scans for *.yaml, *.yml, *.workflow.ts files using readdirSync
 * (matching Phase 6 flat directory scanning pattern).
 * Invalid files are skipped silently (safeParse pattern from 06-02).
 */
export async function discoverWorkflows(
	dirs: string[],
): Promise<Array<{ name: string; path: string; definition: WorkflowDefinition }>> {
	const results: Array<{
		name: string;
		path: string;
		definition: WorkflowDefinition;
	}> = [];

	for (const dir of dirs) {
		let entries: { isFile(): boolean; name: string }[];
		try {
			entries = readdirSync(dir, { withFileTypes: true }) as unknown as {
				isFile(): boolean;
				name: string;
			}[];
		} catch {
			logger.info(`Workflow directory not found, skipping: ${dir}`);
			continue;
		}

		for (const entry of entries) {
			if (!entry.isFile()) continue;

			const name = entry.name;
			const ext = extname(name).toLowerCase();
			const isWorkflow =
				ext === ".yaml" ||
				ext === ".yml" ||
				name.endsWith(".workflow.ts");

			if (!isWorkflow) continue;

			const fullPath = join(dir, name);
			const parseResult = WorkflowDefinitionSchema.safeParse(
				ext === ".yaml" || ext === ".yml"
					? parse(readFileSync(fullPath, "utf-8"))
					: null,
			);

			if (ext === ".yaml" || ext === ".yml") {
				if (parseResult.success) {
					results.push({
						name: parseResult.data.name,
						path: fullPath,
						definition: parseResult.data,
					});
				} else {
					logger.info(
						`Skipping invalid workflow file: ${fullPath}`,
					);
				}
			} else {
				// For .workflow.ts files, we need dynamic import
				try {
					const def = await loadWorkflowDefinition(fullPath);
					results.push({
						name: def.name,
						path: fullPath,
						definition: def,
					});
				} catch {
					logger.info(
						`Skipping invalid workflow file: ${fullPath}`,
					);
				}
			}
		}
	}

	return results.sort((a, b) => a.name.localeCompare(b.name));
}
