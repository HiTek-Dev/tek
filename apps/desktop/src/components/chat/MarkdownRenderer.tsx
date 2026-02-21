import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "./CodeBlock";

interface MarkdownRendererProps {
	content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
	return (
		<ReactMarkdown
			remarkPlugins={[remarkGfm]}
			components={{
				code: ({ className, children }) => (
					<CodeBlock className={className}>{children}</CodeBlock>
				),
				table: ({ children }) => (
					<div className="overflow-x-auto my-3">
						<table className="min-w-full border-collapse text-sm">
							{children}
						</table>
					</div>
				),
				th: ({ children }) => (
					<th className="border-b border-surface-overlay px-3 py-2 text-left text-text-secondary font-medium">
						{children}
					</th>
				),
				td: ({ children }) => (
					<td className="border-b border-surface-overlay px-3 py-2 text-text-primary">
						{children}
					</td>
				),
				a: ({ href, children }) => (
					<a
						href={href}
						target="_blank"
						rel="noopener noreferrer"
						className="text-brand-400 hover:underline"
					>
						{children}
					</a>
				),
				h1: ({ children }) => (
					<h1 className="text-2xl font-semibold text-text-primary mt-4 mb-2">
						{children}
					</h1>
				),
				h2: ({ children }) => (
					<h2 className="text-xl font-semibold text-text-primary mt-4 mb-2">
						{children}
					</h2>
				),
				h3: ({ children }) => (
					<h3 className="text-lg font-semibold text-text-primary mt-4 mb-2">
						{children}
					</h3>
				),
				h4: ({ children }) => (
					<h4 className="text-base font-semibold text-text-primary mt-4 mb-2">
						{children}
					</h4>
				),
				ul: ({ children }) => (
					<ul className="list-disc list-inside space-y-1 my-2 text-text-primary">
						{children}
					</ul>
				),
				ol: ({ children }) => (
					<ol className="list-decimal list-inside space-y-1 my-2 text-text-primary">
						{children}
					</ol>
				),
				blockquote: ({ children }) => (
					<blockquote className="border-l-2 border-brand-400 pl-4 my-2 text-text-secondary italic">
						{children}
					</blockquote>
				),
				p: ({ children }) => (
					<p className="my-1.5 text-text-primary leading-relaxed">
						{children}
					</p>
				),
				hr: () => <hr className="border-surface-overlay my-4" />,
			}}
		>
			{content}
		</ReactMarkdown>
	);
}
