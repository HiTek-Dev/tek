import { nanoid, customAlphabet } from "nanoid";
import { getDb, telegramUsers, pairingCodes } from "@tek/db";
import { eq, and, lt, or } from "drizzle-orm";

/**
 * Custom alphabet: 0-9 + uppercase letters excluding I and O (avoid ambiguity).
 */
const generateCode = customAlphabet("0123456789ABCDEFGHJKLMNPQRSTUVWXYZ", 6);

/**
 * Generate a 6-character pairing code for a Telegram user.
 * Inserts a row into the pairing_codes table with 1-hour expiry.
 */
export function generatePairingCode(
	telegramChatId: number,
	telegramUsername: string | null,
): string {
	const db = getDb();
	const code = generateCode();
	const now = new Date();
	const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour

	db.insert(pairingCodes)
		.values({
			code,
			telegramChatId,
			telegramUsername,
			createdAt: now.toISOString(),
			expiresAt: expiresAt.toISOString(),
			used: false,
		})
		.run();

	return code;
}

/**
 * Verify a pairing code and link the Telegram user to AgentSpace.
 * Returns the chatId and username if valid, null otherwise.
 * Marks the code as used and creates/updates the telegram_users record.
 */
export function verifyPairingCode(
	code: string,
): { chatId: number; username: string | null } | null {
	const db = getDb();
	const now = new Date().toISOString();

	const record = db
		.select()
		.from(pairingCodes)
		.where(eq(pairingCodes.code, code))
		.get();

	if (!record) return null;
	if (record.used) return null;
	if (record.expiresAt < now) return null;

	// Mark code as used
	db.update(pairingCodes)
		.set({ used: true })
		.where(eq(pairingCodes.code, code))
		.run();

	// Check if telegram_users row already exists for this chatId (re-pairing)
	const existingUser = db
		.select()
		.from(telegramUsers)
		.where(eq(telegramUsers.telegramChatId, record.telegramChatId))
		.get();

	if (existingUser) {
		// Update existing user
		db.update(telegramUsers)
			.set({
				pairedAt: new Date().toISOString(),
				active: true,
				telegramUsername: record.telegramUsername,
			})
			.where(eq(telegramUsers.id, existingUser.id))
			.run();
	} else {
		// Insert new user
		db.insert(telegramUsers)
			.values({
				id: nanoid(),
				telegramChatId: record.telegramChatId,
				telegramUsername: record.telegramUsername,
				pairedAt: new Date().toISOString(),
				active: true,
			})
			.run();
	}

	return {
		chatId: record.telegramChatId,
		username: record.telegramUsername,
	};
}

/**
 * Look up a paired and active Telegram user by chatId.
 */
export function getPairedUser(
	telegramChatId: number,
): { id: string; active: boolean } | null {
	const db = getDb();

	const user = db
		.select()
		.from(telegramUsers)
		.where(
			and(
				eq(telegramUsers.telegramChatId, telegramChatId),
				eq(telegramUsers.active, true),
			),
		)
		.get();

	if (!user) return null;
	return { id: user.id, active: user.active };
}

/**
 * Clean up expired or used pairing codes.
 * Deletes codes that are expired OR used and older than 24 hours.
 */
export function cleanExpiredCodes(): void {
	const db = getDb();
	const now = new Date().toISOString();
	const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

	db.delete(pairingCodes)
		.where(
			or(
				lt(pairingCodes.expiresAt, now),
				and(eq(pairingCodes.used, true), lt(pairingCodes.createdAt, oneDayAgo)),
			),
		)
		.run();
}
