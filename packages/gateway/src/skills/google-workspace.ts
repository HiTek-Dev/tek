import { tool } from "ai";
import { z } from "zod";
import { google, type Auth } from "googleapis";

/**
 * Create Google Workspace AI SDK tools for Gmail, Drive, Calendar, and Docs.
 * Requires an authenticated OAuth2Client from createGoogleAuth().
 */
export function createGoogleWorkspaceTools(
	auth: Auth.OAuth2Client,
): Record<string, unknown> {
	const gmail = google.gmail({ version: "v1", auth });
	const drive = google.drive({ version: "v3", auth });
	const calendar = google.calendar({ version: "v3", auth });
	const docs = google.docs({ version: "v1", auth });

	const gmail_search = tool({
		description: "Search Gmail messages by query",
		inputSchema: z.object({
			query: z.string(),
			maxResults: z.number().optional().default(10),
		}),
		execute: async ({ query, maxResults }) => {
			try {
				const listRes = await gmail.users.messages.list({
					userId: "me",
					q: query,
					maxResults,
				});
				const messageIds = listRes.data.messages ?? [];
				const messages = await Promise.all(
					messageIds.slice(0, maxResults).map(async (msg) => {
						const detail = await gmail.users.messages.get({
							userId: "me",
							id: msg.id!,
							format: "metadata",
							metadataHeaders: ["Subject", "From", "Date"],
						});
						const headers = detail.data.payload?.headers ?? [];
						const getHeader = (name: string) =>
							headers.find(
								(h) => h.name?.toLowerCase() === name.toLowerCase(),
							)?.value ?? "";
						return {
							id: msg.id,
							subject: getHeader("Subject"),
							from: getHeader("From"),
							date: getHeader("Date"),
							snippet: detail.data.snippet ?? "",
						};
					}),
				);
				return {
					messages,
					total: listRes.data.resultSizeEstimate ?? messages.length,
				};
			} catch (err) {
				return {
					error:
						err instanceof Error ? err.message : String(err),
				};
			}
		},
	});

	const gmail_read = tool({
		description: "Read a specific Gmail message by ID",
		inputSchema: z.object({
			messageId: z.string(),
		}),
		execute: async ({ messageId }) => {
			try {
				const res = await gmail.users.messages.get({
					userId: "me",
					id: messageId,
					format: "full",
				});
				const headers = res.data.payload?.headers ?? [];
				const getHeader = (name: string) =>
					headers.find(
						(h) => h.name?.toLowerCase() === name.toLowerCase(),
					)?.value ?? "";

				// Extract body: prefer text/plain part
				let body = "";
				const payload = res.data.payload;
				if (payload?.parts) {
					const textPart = payload.parts.find(
						(p) => p.mimeType === "text/plain",
					);
					if (textPart?.body?.data) {
						body = Buffer.from(textPart.body.data, "base64").toString(
							"utf-8",
						);
					}
				} else if (payload?.body?.data) {
					body = Buffer.from(payload.body.data, "base64").toString(
						"utf-8",
					);
				}

				return {
					subject: getHeader("Subject"),
					from: getHeader("From"),
					to: getHeader("To"),
					date: getHeader("Date"),
					body,
				};
			} catch (err) {
				return {
					error:
						err instanceof Error ? err.message : String(err),
				};
			}
		},
	});

	const drive_search = tool({
		description: "Search Google Drive files by query",
		inputSchema: z.object({
			query: z.string(),
			maxResults: z.number().optional().default(10),
		}),
		execute: async ({ query, maxResults }) => {
			try {
				const res = await drive.files.list({
					q: query,
					pageSize: maxResults,
					fields:
						"files(id,name,mimeType,modifiedTime,webViewLink)",
				});
				return {
					files: (res.data.files ?? []).map((f) => ({
						id: f.id,
						name: f.name,
						mimeType: f.mimeType,
						modifiedTime: f.modifiedTime,
						webViewLink: f.webViewLink,
					})),
				};
			} catch (err) {
				return {
					error:
						err instanceof Error ? err.message : String(err),
				};
			}
		},
	});

	const drive_read = tool({
		description:
			"Read content from a Google Drive file (text-based files only)",
		inputSchema: z.object({
			fileId: z.string(),
		}),
		execute: async ({ fileId }) => {
			try {
				// Get file metadata first to determine type
				const meta = await drive.files.get({
					fileId,
					fields: "name,mimeType",
				});
				const mimeType = meta.data.mimeType ?? "";
				const name = meta.data.name ?? "";

				let content: string;
				if (
					mimeType.startsWith("application/vnd.google-apps.")
				) {
					// Google Docs/Sheets/Slides: export as plain text
					const exportRes = await drive.files.export({
						fileId,
						mimeType: "text/plain",
					});
					content = String(exportRes.data);
				} else {
					// Regular files: download content
					const downloadRes = await drive.files.get(
						{ fileId, alt: "media" },
						{ responseType: "text" },
					);
					content = String(downloadRes.data);
				}

				return { content, name, mimeType };
			} catch (err) {
				return {
					error:
						err instanceof Error ? err.message : String(err),
				};
			}
		},
	});

	const calendar_list = tool({
		description: "List upcoming Google Calendar events",
		inputSchema: z.object({
			maxResults: z.number().optional().default(10),
			timeMin: z.string().optional(),
		}),
		execute: async ({ maxResults, timeMin }) => {
			try {
				const res = await calendar.events.list({
					calendarId: "primary",
					maxResults,
					timeMin: timeMin ?? new Date().toISOString(),
					singleEvents: true,
					orderBy: "startTime",
				});
				return {
					events: (res.data.items ?? []).map((e) => ({
						id: e.id,
						summary: e.summary,
						start: e.start,
						end: e.end,
						location: e.location,
						description: e.description,
					})),
				};
			} catch (err) {
				return {
					error:
						err instanceof Error ? err.message : String(err),
				};
			}
		},
	});

	const calendar_create = tool({
		description: "Create a Google Calendar event",
		inputSchema: z.object({
			summary: z.string(),
			startTime: z.string(),
			endTime: z.string(),
			description: z.string().optional(),
			location: z.string().optional(),
		}),
		execute: async ({
			summary,
			startTime,
			endTime,
			description,
			location,
		}) => {
			try {
				const res = await calendar.events.insert({
					calendarId: "primary",
					requestBody: {
						summary,
						start: { dateTime: startTime },
						end: { dateTime: endTime },
						description,
						location,
					},
				});
				return {
					eventId: res.data.id,
					htmlLink: res.data.htmlLink,
				};
			} catch (err) {
				return {
					error:
						err instanceof Error ? err.message : String(err),
				};
			}
		},
	});

	const docs_read = tool({
		description: "Read content of a Google Doc",
		inputSchema: z.object({
			documentId: z.string(),
		}),
		execute: async ({ documentId }) => {
			try {
				const res = await docs.documents.get({ documentId });
				// Extract plain text from document body content elements
				let plainText = "";
				for (const element of res.data.body?.content ?? []) {
					if (element.paragraph) {
						for (const pe of element.paragraph.elements ?? []) {
							if (pe.textRun?.content) {
								plainText += pe.textRun.content;
							}
						}
					}
				}
				return {
					title: res.data.title,
					content: plainText,
				};
			} catch (err) {
				return {
					error:
						err instanceof Error ? err.message : String(err),
				};
			}
		},
	});

	const docs_create = tool({
		description: "Create a new Google Doc",
		inputSchema: z.object({
			title: z.string(),
			content: z.string(),
		}),
		execute: async ({ title, content }) => {
			try {
				const createRes = await docs.documents.create({
					requestBody: { title },
				});
				const documentId = createRes.data.documentId!;

				if (content) {
					await docs.documents.batchUpdate({
						documentId,
						requestBody: {
							requests: [
								{
									insertText: {
										location: { index: 1 },
										text: content,
									},
								},
							],
						},
					});
				}

				return {
					documentId,
					title,
					url: `https://docs.google.com/document/d/${documentId}/edit`,
				};
			} catch (err) {
				return {
					error:
						err instanceof Error ? err.message : String(err),
				};
			}
		},
	});

	return {
		gmail_search,
		gmail_read,
		drive_search,
		drive_read,
		calendar_list,
		calendar_create,
		docs_read,
		docs_create,
	};
}
