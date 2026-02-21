import { useEffect, useRef, useCallback } from "react";
import { useAppStore } from "../stores/app-store";
import { useWebSocket } from "../hooks/useWebSocket";
import { useChat } from "../hooks/useChat";
import { useConfig } from "../hooks/useConfig";
import { useSessions } from "../hooks/useSessions";
import { ChatMessage } from "../components/ChatMessage";
import { StreamingText } from "../components/StreamingText";
import { ChatInput } from "../components/ChatInput";
import { ToolApprovalModal } from "../components/modals/ToolApprovalModal";

/**
 * Full chat interface page.
 * Connects to gateway via Tauri WebSocket plugin, sends/receives messages,
 * and displays streaming responses with styled message bubbles.
 */
export function ChatPage() {
	const gateway = useAppStore((s) => s.gateway);
	const selectedAgentId = useAppStore((s) => s.selectedAgentId);
	const setSelectedAgentId = useAppStore((s) => s.setSelectedAgentId);
	const setSessions = useAppStore((s) => s.setSessions);
	const resumeSessionId = useAppStore((s) => s.resumeSessionId);
	const setResumeSessionId = useAppStore((s) => s.setResumeSessionId);
	const { config } = useConfig();

	const agents = config?.agents?.list ?? [];

	// Auto-select first agent if none selected
	useEffect(() => {
		if (selectedAgentId === null && agents.length > 0) {
			const defaultId = config?.agents?.defaultAgentId;
			const hasDefault = defaultId && agents.some((a) => a.id === defaultId);
			setSelectedAgentId(hasDefault ? defaultId : agents[0].id);
		}
	}, [selectedAgentId, agents, config?.agents?.defaultAgentId, setSelectedAgentId]);

	// Construct WebSocket URL only when gateway is running
	const wsUrl =
		gateway.status === "running" && gateway.port
			? `ws://127.0.0.1:${gateway.port}/gateway`
			: null;

	const ws = useWebSocket(wsUrl);

	const chat = useChat({
		send: ws.send,
		addMessageHandler: ws.addMessageHandler,
		removeMessageHandler: ws.removeMessageHandler,
		connected: ws.connected,
		agentId: selectedAgentId ?? undefined,
	});

	// Fetch sessions and sync to store
	const sessionData = useSessions(
		ws.send,
		ws.addMessageHandler,
		ws.removeMessageHandler,
		ws.connected,
	);

	useEffect(() => {
		setSessions(sessionData.sessions);
	}, [sessionData.sessions, setSessions]);

	// Handle resume session from sidebar click
	const resumeHandled = useRef(false);
	useEffect(() => {
		if (resumeSessionId && !resumeHandled.current) {
			resumeHandled.current = true;
			// Set the sessionId for the next chat message
			chat.setSessionId(resumeSessionId);
			setResumeSessionId(null);
		} else if (!resumeSessionId) {
			resumeHandled.current = false;
		}
	}, [resumeSessionId, chat, setResumeSessionId]);

	// Auto-scroll to bottom
	const scrollRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const el = scrollRef.current;
		if (el) {
			el.scrollTop = el.scrollHeight;
		}
	}, [chat.messages, chat.streamingText]);

	return (
		<div className="flex flex-col h-full">
			{/* Header bar */}
			<div className="flex items-center justify-between px-4 py-3 border-b border-surface-overlay bg-surface-primary/50">
				<div className="flex items-center gap-3">
					<h1 className="text-lg font-semibold text-text-primary">Chat</h1>
					{agents.length > 0 && (
						<select
							value={selectedAgentId ?? ""}
							onChange={(e) =>
								setSelectedAgentId(e.target.value || null)
							}
							className="bg-surface-elevated border border-surface-overlay rounded px-2 py-1 text-sm text-text-primary focus:border-brand-500 focus:outline-none"
						>
							{agents.map((a) => (
								<option key={a.id} value={a.id}>
									{a.name ?? a.id}
								</option>
							))}
						</select>
					)}
					<div className="flex items-center gap-1.5">
						<span
							className={`w-2 h-2 rounded-full ${ws.connected ? "bg-green-400" : "bg-red-400"}`}
						/>
						<span className="text-xs text-text-secondary">
							{ws.connected ? "Connected" : "Disconnected"}
						</span>
					</div>
				</div>
				<div className="flex items-center gap-3 text-xs text-text-muted">
					{chat.sessionId && (
						<span className="font-mono">
							{chat.sessionId.slice(0, 8)}
						</span>
					)}
					{chat.model && (
						<span className="bg-surface-overlay text-text-secondary px-2 py-0.5 rounded">
							{chat.model}
						</span>
					)}
				</div>
			</div>

			{/* Message list */}
			<div
				ref={scrollRef}
				className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
			>
				{chat.messages.length === 0 && !chat.isStreaming && (
					<div className="flex items-center justify-center h-full">
						<div className="text-center">
							<p className="text-text-muted text-sm">
								{ws.connected
									? agents.length === 0
										? "Create an agent with 'tek onboard' in the terminal to start chatting"
										: "Send a message to start chatting"
									: gateway.status === "stopped"
										? "Start the gateway from the Dashboard to begin"
										: "Connecting to gateway..."}
							</p>
							{ws.error && (
								<p className="text-red-400/70 text-xs mt-2">
									{ws.error}
								</p>
							)}
						</div>
					</div>
				)}

				{chat.messages.map((msg) => (
					<ChatMessage
						key={msg.id}
						message={msg}
						model={msg.type === "text" && msg.role === "assistant" ? chat.model : null}
					/>
				))}

				{chat.isStreaming && (
					<StreamingText text={chat.streamingText} model={chat.model} />
				)}

				{chat.error && (
					<div className="flex justify-center mb-3">
						<div className="bg-red-600/10 border border-red-600/20 rounded-lg px-3 py-1.5">
							<p className="text-xs text-red-400 text-center">
								{chat.error}
							</p>
						</div>
					</div>
				)}
			</div>

			{/* Input bar */}
			<ChatInput
				onSend={chat.sendMessage}
				disabled={!ws.connected || chat.isStreaming}
			/>

			{/* Tool approval modal */}
			{chat.pendingApprovals.length > 0 && (
				<ToolApprovalModal
					toolName={chat.pendingApprovals[0].toolName}
					toolCallId={chat.pendingApprovals[0].toolCallId}
					args={chat.pendingApprovals[0].args}
					risk={chat.pendingApprovals[0].risk}
					queueSize={chat.pendingApprovals.length}
					onResponse={chat.handleApproval}
				/>
			)}
		</div>
	);
}
