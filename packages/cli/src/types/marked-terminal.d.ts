declare module "marked-terminal" {
	import type { MarkedExtension } from "marked";

	interface MarkedTerminalOptions {
		width?: number;
		tab?: number;
		reflowText?: boolean;
		[key: string]: unknown;
	}

	export function markedTerminal(
		options?: MarkedTerminalOptions,
		highlightOptions?: Record<string, unknown>,
	): MarkedExtension;

	export default class Renderer {
		constructor(
			options?: MarkedTerminalOptions,
			highlightOptions?: Record<string, unknown>,
		);
	}
}
