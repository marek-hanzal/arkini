import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { chmodSync, mkdirSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createId } from "@paralleldrive/cuid2";
import { Effect, Semaphore } from "effect";
import type {
	AccessToken,
	AuthorizationCode,
	OAuthClientInformationFull,
	OAuthClientMetadata,
	OAuthServerModel,
	RefreshToken,
} from "mcp-oauth-server";

import type { EditorMcpAuthOwnership } from "./EditorMcpAuthOwnership";

interface PayloadRow {
	readonly payload: string;
}

interface SecretRecord {
	readonly secret?: string;
	readonly salt: string;
	readonly hash: string;
}

const encode = (value: unknown) => JSON.stringify(value);

const decode = <Value>(row: PayloadRow | undefined): Value | undefined =>
	row === undefined ? undefined : (JSON.parse(row.payload) as Value);

const decodeAuthorizationCode = (row: PayloadRow | undefined): AuthorizationCode | undefined => {
	const value = decode<
		Omit<AuthorizationCode, "expiresAt"> & {
			readonly expiresAt: string;
		}
	>(row);
	return value === undefined
		? undefined
		: {
				...value,
				expiresAt: new Date(value.expiresAt),
			};
};

const decodeAccessToken = (row: PayloadRow | undefined): AccessToken | undefined => {
	const value = decode<
		Omit<AccessToken, "expiresAt"> & {
			readonly expiresAt: string;
		}
	>(row);
	return value === undefined
		? undefined
		: {
				...value,
				expiresAt: new Date(value.expiresAt),
			};
};

const decodeRefreshToken = (row: PayloadRow | undefined): RefreshToken | undefined => {
	const value = decode<
		Omit<RefreshToken, "expiresAt"> & {
			readonly expiresAt: string;
		}
	>(row);
	return value === undefined
		? undefined
		: {
				...value,
				expiresAt: new Date(value.expiresAt),
			};
};

const initializeDatabase = (database: DatabaseSync) => {
	database.exec("PRAGMA foreign_keys = ON");
	const version = database.prepare("PRAGMA user_version").get()?.user_version;
	if (version !== 0 && version !== 1)
		throw new Error(`Unsupported Remote MCP auth database version ${String(version)}.`);
	if (version === 1) return;
	database.exec(`
		BEGIN IMMEDIATE;
		CREATE TABLE oauth_meta (
			key TEXT PRIMARY KEY NOT NULL,
			value TEXT NOT NULL
		) STRICT;
		CREATE TABLE oauth_clients (
			client_id TEXT PRIMARY KEY NOT NULL,
			payload TEXT NOT NULL
		) STRICT;
		CREATE TABLE oauth_authorization_codes (
			token TEXT PRIMARY KEY NOT NULL,
			client_id TEXT NOT NULL,
			payload TEXT NOT NULL
		) STRICT;
		CREATE TABLE oauth_access_tokens (
			token TEXT PRIMARY KEY NOT NULL,
			client_id TEXT NOT NULL,
			grant_id TEXT,
			payload TEXT NOT NULL
		) STRICT;
		CREATE TABLE oauth_refresh_tokens (
			token TEXT PRIMARY KEY NOT NULL,
			client_id TEXT NOT NULL,
			grant_id TEXT,
			payload TEXT NOT NULL
		) STRICT;
		PRAGMA user_version = 1;
		COMMIT;
	`);
};

const createSecretRecord = (secret: string): SecretRecord => {
	const salt = randomBytes(16);
	return {
		secret,
		salt: salt.toString("base64url"),
		hash: scryptSync(secret, salt, 32).toString("base64url"),
	};
};

const createSecret = () => `arkini_mcp_${createId()}`;

export namespace createSqliteEditorMcpAuthOwnershipFx {
	export interface Props {
		readonly databasePath: string;
	}
}

/** Owns the recoverable installation-wide OAuth database used only by Remote MCP. */
export const createSqliteEditorMcpAuthOwnershipFx = Effect.fn(
	"createSqliteEditorMcpAuthOwnershipFx",
)(function* ({ databasePath }: createSqliteEditorMcpAuthOwnershipFx.Props) {
	let database: DatabaseSync | undefined;
	const lifecycleLock = yield* Semaphore.make(1);
	const readDatabase = () => {
		if (database !== undefined) return database;
		if (databasePath !== ":memory:")
			mkdirSync(dirname(databasePath), {
				recursive: true,
			});
		const opened = new DatabaseSync(databasePath, {
			timeout: 5_000,
		});
		try {
			initializeDatabase(opened);
			if (databasePath !== ":memory:") chmodSync(databasePath, 0o600);
		} catch (cause) {
			opened.close();
			throw cause;
		}
		database = opened;
		return opened;
	};
	const readPayload = (sql: string, ...params: ReadonlyArray<string>) =>
		readDatabase()
			.prepare(sql)
			.get(...params) as PayloadRow | undefined;
	const runTransaction = (run: (database: DatabaseSync) => void) => {
		const current = readDatabase();
		current.exec("BEGIN IMMEDIATE");
		try {
			run(current);
			current.exec("COMMIT");
		} catch (cause) {
			try {
				current.exec("ROLLBACK");
			} catch {
				// Preserve the original mutation failure.
			}
			throw cause;
		}
	};
	const model: OAuthServerModel = {
		async getClient(clientId) {
			return decode<OAuthClientInformationFull>(
				readPayload("SELECT payload FROM oauth_clients WHERE client_id = ?", clientId),
			);
		},
		async registerClient(client: OAuthClientMetadata) {
			const registered = client as OAuthClientInformationFull;
			readDatabase()
				.prepare("INSERT OR REPLACE INTO oauth_clients (client_id, payload) VALUES (?, ?)")
				.run(registered.client_id, encode(registered));
			return registered;
		},
		async saveAuthorizationCode(code) {
			readDatabase()
				.prepare(
					"INSERT OR REPLACE INTO oauth_authorization_codes (token, client_id, payload) VALUES (?, ?, ?)",
				)
				.run(code.authorizationCode, code.clientId, encode(code));
		},
		async consumeAuthorizationCode(token, clientId) {
			return decodeAuthorizationCode(
				readPayload(
					"DELETE FROM oauth_authorization_codes WHERE token = ? AND client_id = ? RETURNING payload",
					token,
					clientId,
				),
			);
		},
		async revokeAuthorizationCode(token) {
			readDatabase()
				.prepare("DELETE FROM oauth_authorization_codes WHERE token = ?")
				.run(token);
		},
		async saveAccessToken(token) {
			readDatabase()
				.prepare(
					"INSERT OR REPLACE INTO oauth_access_tokens (token, client_id, grant_id, payload) VALUES (?, ?, ?, ?)",
				)
				.run(token.token, token.clientId, token.grantId ?? null, encode(token));
		},
		async getAccessToken(token) {
			return decodeAccessToken(
				readPayload("SELECT payload FROM oauth_access_tokens WHERE token = ?", token),
			);
		},
		async revokeAccessToken(token, clientId) {
			return decodeAccessToken(
				readPayload(
					"DELETE FROM oauth_access_tokens WHERE token = ? AND client_id = ? RETURNING payload",
					token,
					clientId,
				),
			);
		},
		async saveRefreshToken(token) {
			readDatabase()
				.prepare(
					"INSERT OR REPLACE INTO oauth_refresh_tokens (token, client_id, grant_id, payload) VALUES (?, ?, ?, ?)",
				)
				.run(token.token, token.clientId, token.grantId ?? null, encode(token));
		},
		async consumeRefreshToken(token, clientId) {
			return decodeRefreshToken(
				readPayload(
					"DELETE FROM oauth_refresh_tokens WHERE token = ? AND client_id = ? RETURNING payload",
					token,
					clientId,
				),
			);
		},
		async revokeRefreshToken(token, clientId) {
			return decodeRefreshToken(
				readPayload(
					"DELETE FROM oauth_refresh_tokens WHERE token = ? AND client_id = ? RETURNING payload",
					token,
					clientId,
				),
			);
		},
		async revokeGrant(grantId) {
			runTransaction((current) => {
				current.prepare("DELETE FROM oauth_access_tokens WHERE grant_id = ?").run(grantId);
				current.prepare("DELETE FROM oauth_refresh_tokens WHERE grant_id = ?").run(grantId);
			});
		},
	};
	const readSecretRecord = (): SecretRecord | undefined => {
		const row = readDatabase()
			.prepare("SELECT value FROM oauth_meta WHERE key = 'secret'")
			.get() as
			| {
					readonly value: string;
			  }
			| undefined;
		return row === undefined ? undefined : (JSON.parse(row.value) as SecretRecord);
	};
	const writeSecret = (secret: string) => {
		readDatabase()
			.prepare("INSERT OR REPLACE INTO oauth_meta (key, value) VALUES ('secret', ?)")
			.run(encode(createSecretRecord(secret)));
	};
	const closeDatabase = () => {
		const current = database;
		database = undefined;
		current?.close();
	};
	return {
		model,
		ensureSecretFx: lifecycleLock.withPermits(1)(
			Effect.try({
				try: () => {
					const existing = readSecretRecord()?.secret;
					if (typeof existing === "string" && existing !== "") return existing;
					const secret = createSecret();
					writeSecret(secret);
					return secret;
				},
				catch: (cause) => cause,
			}),
		),
		verifySecretFx: (candidate) =>
			Effect.try({
				try: () => {
					const record = readSecretRecord();
					if (record === undefined) return false;
					const expected = Buffer.from(record.hash, "base64url");
					const actual = scryptSync(candidate, Buffer.from(record.salt, "base64url"), 32);
					return expected.length === actual.length && timingSafeEqual(expected, actual);
				},
				catch: (cause) => cause,
			}),
		resetFx: lifecycleLock.withPermits(1)(
			Effect.try({
				try: () => {
					closeDatabase();
					if (databasePath !== ":memory:") {
						for (const path of [
							databasePath,
							`${databasePath}-shm`,
							`${databasePath}-wal`,
						])
							rmSync(path, {
								force: true,
							});
					}
					const secret = createSecret();
					writeSecret(secret);
					return secret;
				},
				catch: (cause) => cause,
			}),
		),
		closeFx: lifecycleLock.withPermits(1)(Effect.sync(closeDatabase)),
	} satisfies EditorMcpAuthOwnership;
});
