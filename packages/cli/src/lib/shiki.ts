import { createHighlighterCoreSync } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import { bundledLanguages } from "shiki/langs";
import { bundledThemes } from "shiki/themes";
import c from "ansis";

// FontStyle bitflags from @shikijs/vscode-textmate (not directly importable as transitive dep)
const FontStyle = {
	Italic: 1,
	Bold: 2,
	Underline: 4,
} as const;

// Language names to load for syntax highlighting
const LANG_NAMES = [
	"typescript",
	"javascript",
	"json",
	"bash",
	"python",
	"css",
	"html",
	"yaml",
	"markdown",
	"tsx",
	"jsx",
] as const;

// Pre-resolve async grammar loaders into plain objects for sync highlighter init
const resolvedLangs = await Promise.all(
	LANG_NAMES.map(async (name) => {
		const mod = await bundledLanguages[name]();
		return mod.default;
	}),
);

const themeModule = await bundledThemes["github-dark"]();

const highlighter = createHighlighterCoreSync({
	themes: [themeModule.default],
	langs: resolvedLangs.flat(),
	engine: createJavaScriptRegexEngine(),
});

/**
 * Synchronous code-to-ANSI highlighting using shiki TextMate grammars.
 * Falls back to plain text for unknown languages or on error.
 */
export function codeToAnsiSync(code: string, lang: string): string {
	try {
		const loadedLangs = highlighter.getLoadedLanguages();
		const effectiveLang = loadedLangs.includes(lang) ? lang : "text";

		const tokens = highlighter.codeToTokensBase(code, {
			lang: effectiveLang,
			theme: "github-dark",
		});

		const theme = highlighter.getTheme("github-dark");
		let output = "";

		for (const line of tokens) {
			for (const token of line) {
				let text = token.content;
				const color = token.color || theme.fg;
				if (color) text = c.hex(color)(text);
				if (token.fontStyle) {
					if (token.fontStyle & FontStyle.Bold) text = c.bold(text);
					if (token.fontStyle & FontStyle.Italic) text = c.italic(text);
					if (token.fontStyle & FontStyle.Underline)
						text = c.underline(text);
				}
				output += text;
			}
			output += "\n";
		}

		return output.replace(/\n$/, "");
	} catch {
		// Graceful fallback: return raw code on any highlighting error
		return code;
	}
}
