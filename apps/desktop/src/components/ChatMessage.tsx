import type { ChatMessage as ChatMessageType } from "../lib/gateway-client";
import { MarkdownRenderer } from "./chat/MarkdownRenderer";

interface ChatMessageProps {
	message: ChatMessageType;
}

function formatTime(timestamp: string): string {
	try {
		const d = new Date(timestamp);
		return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
	} catch {
		return "";
	}
}

export function ChatMessage({ message }: ChatMessageProps) {
	if (message.type === "text") {
		if (message.role === "user") {
			return (
				<div className="flex justify-end">
					<div className="max-w-[75%]">
						<p className="text-xs text-gray-500 mb-1 text-right">You</p>
						<div className="bg-brand-600/20 border-l-2 border-brand-500 text-gray-100 rounded-lg rounded-br-sm px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
							{message.content}
						</div>
						<p className="text-[10px] text-gray-500 mt-1 text-right">
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
						<p className="text-xs text-gray-500 mb-1">Assistant</p>
						<div className="bg-surface-elevated/50 border-l-2 border-surface-overlay text-gray-100 rounded-lg rounded-bl-sm px-4 py-3 text-sm leading-relaxed">
							<MarkdownRenderer content={message.content} />
						</div>
						<p className="text-[10px] text-gray-500 mt-1">
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
		return (
			<div className="flex justify-start">
				<div className="max-w-[85%] bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2">
					<div className="flex items-center gap-2 mb-1">
						<span className="text-[10px] font-mono text-brand-400 bg-brand-400/10 px-1.5 py-0.5 rounded">
							{message.toolName}
						</span>
						<span
							className={`text-[10px] ${message.status === "complete" ? "text-green-400" : message.status === "error" ? "text-red-400" : "text-yellow-400"}`}
						>
							{message.status}
						</span>
					</div>
					{message.input && (
						<pre className="text-[11px] text-gray-400 font-mono overflow-x-auto max-h-24 overflow-y-auto">
							{message.input.length > 200
								? `${message.input.slice(0, 200)}...`
								: message.input}
						</pre>
					)}
					{message.output && (
						<pre className="text-[11px] text-gray-300 font-mono mt-1 border-t border-gray-700 pt-1 overflow-x-auto max-h-24 overflow-y-auto">
							{message.output.length > 300
								? `${message.output.slice(0, 300)}...`
								: message.output}
						</pre>
					)}
				</div>
			</div>
		);
	}

	if (message.type === "bash_command") {
		return (
			<div className="flex justify-start">
				<div className="max-w-[85%] bg-gray-900 border border-gray-700 rounded-lg px-3 py-2">
					<p className="text-[11px] font-mono text-green-400">
						$ {message.command}
					</p>
					{message.output && (
						<pre className="text-[11px] text-gray-400 font-mono mt-1 overflow-x-auto max-h-24 overflow-y-auto">
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
				<div className="max-w-[75%] bg-gray-800/40 border-l-2 border-blue-500/30 rounded-r-lg px-3 py-2">
					<p className="text-[10px] text-blue-400/60 mb-0.5">thinking...</p>
					<p className="text-xs text-gray-400 italic whitespace-pre-wrap">
						{message.content}
					</p>
				</div>
			</div>
		);
	}

	return null;
}
