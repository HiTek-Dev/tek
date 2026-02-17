import { google, type Auth } from "googleapis";

export interface GoogleAuthConfig {
	clientId: string;
	clientSecret: string;
	refreshToken: string;
}

/**
 * Create an OAuth2 client configured with refresh token credentials.
 * Uses OAuth 2.0 for personal accounts (not service accounts).
 * Token refresh is handled automatically by the googleapis library.
 */
export function createGoogleAuth(config: GoogleAuthConfig): Auth.OAuth2Client {
	const { clientId, clientSecret, refreshToken } = config;
	const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
	oauth2Client.setCredentials({ refresh_token: refreshToken });
	return oauth2Client;
}
