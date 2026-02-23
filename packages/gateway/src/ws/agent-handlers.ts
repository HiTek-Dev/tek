import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Transport } from "../transport.js";
import type {
	AgentIdentityRead,
	AgentIdentityWrite,
	AgentCreate,
	AgentUpdate,
	AgentDelete,
	TelegramUsersList,
	TelegramUsersUpdate,
} from "./protocol.js";
import { loadConfig, saveConfig, createLogger, CONFIG_DIR } from "@tek/core";
import { getDb, telegramUsers } from "@tek/db";
import { eq } from "drizzle-orm";

const logger = createLogger("agent-handlers");

const IDENTITY_FILES = ["SOUL.md", "IDENTITY.md", "STYLE.md", "USER.md", "ROUTING.md"];

function resolveAgentDir(agentId: string): string {
	return join(CONFIG_DIR, "agents", agentId);
}

export function handleAgentIdentityRead(transport: Transport, msg: AgentIdentityRead): void {
	try {
		const file = msg.file;
		if (!IDENTITY_FILES.includes(file)) {
			transport.send({
				type: "agent.identity.read.result",
				id: msg.id,
				agentId: msg.agentId,
				file: msg.file,
				content: "",
				exists: false,
			});
			return;
		}

		const dir = resolveAgentDir(msg.agentId);
		const path = join(dir, file);
		const fileExists = existsSync(path);
		const content = fileExists ? readFileSync(path, "utf-8") : "";

		transport.send({
			type: "agent.identity.read.result",
			id: msg.id,
			agentId: msg.agentId,
			file: msg.file,
			content,
			exists: fileExists,
		});
	} catch (err) {
		transport.send({
			type: "error",
			requestId: msg.id,
			code: "AGENT_ERROR",
			message: err instanceof Error ? err.message : "Failed to read identity file",
		});
	}
}

export function handleAgentIdentityWrite(transport: Transport, msg: AgentIdentityWrite): void {
	try {
		if (!IDENTITY_FILES.includes(msg.file)) {
			transport.send({
				type: "agent.identity.write.result",
				id: msg.id,
				success: false,
				error: `Invalid identity file: ${msg.file}`,
			});
			return;
		}

		const dir = resolveAgentDir(msg.agentId);
		mkdirSync(dir, { recursive: true });
		const path = join(dir, msg.file);
		writeFileSync(path, msg.content, "utf-8");
		logger.info(`Identity file written: ${msg.agentId}/${msg.file}`);

		transport.send({
			type: "agent.identity.write.result",
			id: msg.id,
			success: true,
		});
	} catch (err) {
		transport.send({
			type: "agent.identity.write.result",
			id: msg.id,
			success: false,
			error: err instanceof Error ? err.message : "Failed to write identity file",
		});
	}
}

export function handleAgentCreate(transport: Transport, msg: AgentCreate): void {
	try {
		const config = loadConfig();
		if (!config) {
			transport.send({
				type: "agent.create.result",
				id: msg.id,
				success: false,
				error: "No config file found. Run 'tek init' first.",
			});
			return;
		}

		const agents = config.agents ?? { list: [], defaultAgentId: "" };
		const existing = agents.list.find((a) => a.id === msg.agent.id);
		if (existing) {
			transport.send({
				type: "agent.create.result",
				id: msg.id,
				success: false,
				error: `Agent with id "${msg.agent.id}" already exists`,
			});
			return;
		}

		agents.list.push({
			...msg.agent,
			accessMode: "full",
			createdAt: new Date().toISOString(),
		});
		config.agents = agents;
		saveConfig(config);
		logger.info(`Agent created: ${msg.agent.id}`);

		// Create agent directory
		const dir = resolveAgentDir(msg.agent.id);
		mkdirSync(dir, { recursive: true });

		transport.send({
			type: "agent.create.result",
			id: msg.id,
			success: true,
			agentId: msg.agent.id,
		});
	} catch (err) {
		transport.send({
			type: "agent.create.result",
			id: msg.id,
			success: false,
			error: err instanceof Error ? err.message : "Failed to create agent",
		});
	}
}

export function handleAgentUpdate(transport: Transport, msg: AgentUpdate): void {
	try {
		const config = loadConfig();
		if (!config?.agents) {
			transport.send({
				type: "agent.update.result",
				id: msg.id,
				success: false,
				error: "No agents configured",
			});
			return;
		}

		const idx = config.agents.list.findIndex((a) => a.id === msg.agentId);
		if (idx === -1) {
			transport.send({
				type: "agent.update.result",
				id: msg.id,
				success: false,
				error: `Agent "${msg.agentId}" not found`,
			});
			return;
		}

		config.agents.list[idx] = { ...config.agents.list[idx], ...msg.patch } as typeof config.agents.list[0];
		saveConfig(config);
		logger.info(`Agent updated: ${msg.agentId}`);

		transport.send({
			type: "agent.update.result",
			id: msg.id,
			success: true,
		});
	} catch (err) {
		transport.send({
			type: "agent.update.result",
			id: msg.id,
			success: false,
			error: err instanceof Error ? err.message : "Failed to update agent",
		});
	}
}

export function handleAgentDelete(transport: Transport, msg: AgentDelete): void {
	try {
		const config = loadConfig();
		if (!config?.agents) {
			transport.send({
				type: "agent.delete.result",
				id: msg.id,
				success: false,
				error: "No agents configured",
			});
			return;
		}

		const idx = config.agents.list.findIndex((a) => a.id === msg.agentId);
		if (idx === -1) {
			transport.send({
				type: "agent.delete.result",
				id: msg.id,
				success: false,
				error: `Agent "${msg.agentId}" not found`,
			});
			return;
		}

		config.agents.list.splice(idx, 1);
		if (config.agents.defaultAgentId === msg.agentId) {
			config.agents.defaultAgentId = config.agents.list[0]?.id ?? "";
		}
		saveConfig(config);
		logger.info(`Agent deleted: ${msg.agentId}`);

		transport.send({
			type: "agent.delete.result",
			id: msg.id,
			success: true,
		});
	} catch (err) {
		transport.send({
			type: "agent.delete.result",
			id: msg.id,
			success: false,
			error: err instanceof Error ? err.message : "Failed to delete agent",
		});
	}
}

export async function handleTelegramUsersList(transport: Transport, msg: TelegramUsersList): Promise<void> {
	try {
		const db = getDb();
		const users = db.select().from(telegramUsers).all();
		transport.send({
			type: "telegram.users.list.result",
			id: msg.id,
			users: users.map((u) => ({
				id: u.id,
				telegramChatId: u.telegramChatId,
				telegramUserId: u.telegramUserId,
				telegramUsername: u.telegramUsername,
				pairedAt: u.pairedAt,
				active: u.active ?? true,
				approved: u.approved ?? false,
			})),
		});
	} catch (err) {
		transport.send({
			type: "error",
			requestId: msg.id,
			code: "TELEGRAM_ERROR",
			message: err instanceof Error ? err.message : "Failed to list Telegram users",
		});
	}
}

export async function handleTelegramUsersUpdate(transport: Transport, msg: TelegramUsersUpdate): Promise<void> {
	try {
		const db = getDb();
		db.update(telegramUsers)
			.set({ approved: msg.approved, active: msg.approved })
			.where(eq(telegramUsers.telegramChatId, msg.telegramChatId))
			.run();

		logger.info(`Telegram user ${msg.telegramChatId} ${msg.approved ? "approved" : "denied"}`);

		transport.send({
			type: "telegram.users.update.result",
			id: msg.id,
			success: true,
		});
	} catch (err) {
		transport.send({
			type: "telegram.users.update.result",
			id: msg.id,
			success: false,
			error: err instanceof Error ? err.message : "Failed to update Telegram user",
		});
	}
}
