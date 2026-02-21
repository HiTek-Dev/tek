import { useState } from "react";
import type { ChatMessage as ChatMessageType } from "../lib/gateway-client";
import { MarkdownRenderer } from "./chat/MarkdownRenderer";
import { Badge } from "./ui/Badge";

interface ChatMessageProps {
	message: ChatMessageType;
	model?: string | null;
}

function formatTime(timestamp: string): string {
	try {
		const d = new Date(timestamp);
		return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
	} catch {
		return "";
	}
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
	return (
		<svg
			className={`w-3.5 h-3.5 text-text-secondary transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			strokeWidth={2}
		>
			<path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
		</svg>
	);
}

export function ChatMessage({ message, model }: ChatMessageProps) {
	if (message.type === "text") {
		if (message.role === "user") {
			return (
				<div className="flex justify-end">
					<div className="max-w-[75%]">
						<p className="text-xs text-text-muted mb-1 text-right">You</p>
						<div className="bg-brand-600/20 border-l-2 border-brand-500 text-text-primary rounded-lg rounded-br-sm px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
							{message.content}
						</div>
						<p className="text-[10px] text-text-muted mt-1 text-right">
							{formatTime(message.timestamp)}
						</p>
					</div>
				</div>
			);
		}

		if (message.role === "assistant") {
			return (
				<div className="flex justify-start">
					<div className="max-w-[75%]">
						<div className="flex items-center gap-2 mb-1">
							<p className="text-xs text-text-muted">Assistant</p>
							{model && <Badge variant="brand">{model}</Badge>}
						</div>
						<div className="bg-surface-elevated/50 border-l-2 border-surface-overlay text-text-primary rounded-lg rounded-bl-sm px-4 py-3 text-sm leading-relaxed">
							<MarkdownRenderer content={message.content} />
						</div>
						<p className="text-[10px] text-text-muted mt-1">
							{formatTime(message.timestamp)}
						</p>
					</div>
				</div>
			);
		}

		// System message
		return (
			<div className="flex justify-center">
				<div className="bg-yellow-600/10 border border-yellow-600/20 rounded-lg px-3 py-1.5 max-w-[85%]">
					<p className="text-xs text-yellow-400/80 text-center whitespace-pre-wrap">
						{message.content}
					</p>
				</div>
			</div>
		);
	}

	if (message.type === "tool_call") {
		return <ToolCallCard message={message} />;
	}

	if (message.type === "bash_command") {
		return (
			<div className="flex justify-start">
				<div className="max-w-[85%] bg-surface-primary border border-surface-overlay rounded-lg px-3 py-2">
					<p className="text-[11px] font-mono text-green-400">
						$ {message.command}
					</p>
					{message.output && (
						<pre className="text-[11px] text-text-secondary font-mono mt-1 overflow-x-auto max-h-24 overflow-y-auto">
							{message.output.length > 300
								? `${message.output.slice(0, 300)}...`
								: message.output}
						</pre>
					)}
				</div>
			</div>
		);
	}

	if (message.type === "reasoning") {
		return (
			<div className="flex justify-start">
				<div className="max-w-[75%] bg-surface-elevated/40 border-l-2 border-brand-500/30 rounded-r-lg px-3 py-2">
					<p className="text-[10px] text-brand-400/60 mb-0.5">thinking...</p>
					<p className="text-xs text-text-secondary italic whitespace-pre-wrap">
						{message.content}
					</p>
				</div>
			</div>
		);
	}

	return null;
}

function ToolCallCard({
	message,
}: {
	message: Extract<ChatMessageType, { type: "tool_call" }>;
}) {
	const [expanded, setExpanded] = useState(message.status === "pending");

	return (
		<div className="flex justify-start">
			<div className="max-w-[85%] bg-surface-elevated/60 border border-surface-overlay rounded-lg px-3 py-2">
				<button
					type="button"
					onClick={() => setExpanded((prev) => !prev)}
					className="flex items-center gap-2 w-full text-left"
				>
					<ChevronIcon expanded={expanded} />
					<span className="text-[10px] font-mono text-brand-400 bg-brand-400/10 px-1.5 py-0.5 rounded">
						{message.toolName}
					</span>
					<span
						className={`text-[10px] ${message.status === "complete" ? "text-green-400" : message.status === "error" ? "text-red-400" : "text-yellow-400"}`}
					>
						{message.status}
					</span>
				</button>
				<div
					className={`transition-all duration-200 overflow-hidden ${expanded ? "max-h-96" : "max-h-0"}`}
				>
					{message.input && (
						<pre className="text-[11px] text-text-secondary font-mono overflow-x-auto max-h-24 overflow-y-auto mt-2">
							{message.input.length > 200
								? `${message.input.slice(0, 200)}...`
								: message.input}
						</pre>
					)}
					{message.output && (
						<pre className="text-[11px] text-text-primary font-mono mt-1 border-t border-surface-overlay pt-1 overflow-x-auto max-h-24 overflow-y-auto">
							{message.output.length > 300
								? `${message.output.slice(0, 300)}...`
								: message.output}
						</pre>
					)}
				</div>
			</div>
		</div>
	);
}
