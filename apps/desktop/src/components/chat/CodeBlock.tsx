import { useState } from "react";
import { ShikiHighlighter } from "react-shiki";

interface CodeBlockProps {
	className?: string;
	children?: React.ReactNode;
}

export function CodeBlock({ className, children }: CodeBlockProps) {
	const [copied, setCopied] = useState(false);
	const match = className ? /language-(\w+)/.exec(className) : null;

	if (!match) {
		return (
			<code className="bg-surface-elevated px-1.5 py-0.5 rounded text-sm font-mono text-brand-400">
				{children}
			</code>
		);
	}

	const lang = match[1];
	const code = String(children).replace(/\n$/, "");

	const handleCopy = () => {
		navigator.clipboard.writeText(code);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<div className="relative group my-3">
			<button
				type="button"
				onClick={handleCopy}
				className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-text-secondary bg-surface-elevated px-2 py-1 rounded hover:text-text-primary"
			>
				{copied ? "Copied!" : "Copy"}
			</button>
			<ShikiHighlighter language={lang} theme="github-dark">
				{code}
			</ShikiHighlighter>
		</div>
	);
}
