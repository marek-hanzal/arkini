import { timingSafeEqual } from "node:crypto";
import {
	chmodSync,
	closeSync,
	fsyncSync,
	mkdirSync,
	openSync,
	readFileSync,
	renameSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { createId } from "@paralleldrive/cuid2";
import { Effect } from "effect";
import type {
	AccessToken,
	AuthorizationCode,
	OAuthClientInformationFull,
	OAuthClientMetadata,
	OAuthServerModel,
	RefreshToken,
} from "mcp-oauth-server";

import { EditorMcpNgrokSettingsSchema } from "../../../contract/editor/EditorMcpConfigurationSchema";
import { EditorMcpPortSchema } from "../../../contract/editor/EditorMcpPortSchema";
import type { EditorMcpStorage } from "./EditorMcpStorage";

export const DefaultEditorMcpPort = 32_310;
const MaxEditorMcpClients = 100;

interface StoredNgrok {
	readonly authtoken: string;
	readonly domain: string;
}

interface StoredState {
	readonly port: number;
	readonly ngrok?: StoredNgrok;
	readonly password: string;
	readonly clients: ReadonlyArray<OAuthClientInformationFull>;
	readonly authorizationCodes: ReadonlyArray<AuthorizationCode>;
	readonly accessTokens: ReadonlyArray<AccessToken>;
	readonly refreshTokens: ReadonlyArray<RefreshToken>;
}

interface State {
	port: number;
	ngrok?: StoredNgrok;
	readonly password: string;
	readonly clients: Map<string, OAuthClientInformationFull>;
	readonly authorizationCodes: Map<string, AuthorizationCode>;
	readonly accessTokens: Map<string, AccessToken>;
	readonly refreshTokens: Map<string, RefreshToken>;
}

const createPassword = () => `arkini_mcp_${createId()}`;

const createState = (port = DefaultEditorMcpPort, ngrok?: StoredNgrok): State => ({
	port,
	...(ngrok === undefined
		? {}
		: {
				ngrok,
			}),
	password: createPassword(),
	clients: new Map(),
	authorizationCodes: new Map(),
	accessTokens: new Map(),
	refreshTokens: new Map(),
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const parseDated = <
	Value extends {
		readonly expiresAt: Date;
	},
>(
	value: unknown,
): Value => {
	if (!isRecord(value) || typeof value.expiresAt !== "string") throw new Error("Invalid token.");
	const expiresAt = new Date(value.expiresAt);
	if (Number.isNaN(expiresAt.valueOf())) throw new Error("Invalid token expiry.");
	return {
		...value,
		expiresAt,
	} as Value;
};

const parseState = (stored: string): State => {
	const value: unknown = JSON.parse(stored);
	if (
		!isRecord(value) ||
		typeof value.password !== "string" ||
		value.password === "" ||
		!Array.isArray(value.clients) ||
		!Array.isArray(value.authorizationCodes) ||
		!Array.isArray(value.accessTokens) ||
		!Array.isArray(value.refreshTokens)
	)
		throw new Error("Invalid MCP storage.");
	const port = EditorMcpPortSchema.parse(value.port);
	let ngrok: StoredNgrok | undefined;
	if (value.ngrok !== undefined) {
		if (
			!isRecord(value.ngrok) ||
			typeof value.ngrok.authtoken !== "string" ||
			typeof value.ngrok.domain !== "string" ||
			value.ngrok.authtoken === "" ||
			value.ngrok.domain === ""
		)
			throw new Error("Invalid MCP ngrok storage.");
		ngrok = {
			authtoken: value.ngrok.authtoken,
			domain: value.ngrok.domain,
		};
	}
	const clients = value.clients.map((client) => {
		if (!isRecord(client) || typeof client.client_id !== "string")
			throw new Error("Invalid OAuth client.");
		return client as OAuthClientInformationFull;
	});
	const authorizationCodes = value.authorizationCodes.map((code) =>
		parseDated<AuthorizationCode>(code),
	);
	const accessTokens = value.accessTokens.map((token) => parseDated<AccessToken>(token));
	const refreshTokens = value.refreshTokens.map((token) => parseDated<RefreshToken>(token));
	return {
		port,
		...(ngrok === undefined
			? {}
			: {
					ngrok,
				}),
		password: value.password,
		clients: new Map(
			clients.map((client) => [
				client.client_id,
				client,
			]),
		),
		authorizationCodes: new Map(
			authorizationCodes.map((code) => [
				code.authorizationCode,
				code,
			]),
		),
		accessTokens: new Map(
			accessTokens.map((token) => [
				token.token,
				token,
			]),
		),
		refreshTokens: new Map(
			refreshTokens.map((token) => [
				token.token,
				token,
			]),
		),
	};
};

const serializeState = (state: State): StoredState => ({
	port: state.port,
	...(state.ngrok === undefined
		? {}
		: {
				ngrok: state.ngrok,
			}),
	password: state.password,
	clients: [
		...state.clients.values(),
	],
	authorizationCodes: [
		...state.authorizationCodes.values(),
	],
	accessTokens: [
		...state.accessTokens.values(),
	],
	refreshTokens: [
		...state.refreshTokens.values(),
	],
});

const cloneState = (state: State): State => ({
	...state,
	clients: new Map(state.clients),
	authorizationCodes: new Map(state.authorizationCodes),
	accessTokens: new Map(state.accessTokens),
	refreshTokens: new Map(state.refreshTokens),
});

const isMissing = (cause: unknown) => isRecord(cause) && cause.code === "ENOENT";

export namespace createFilesystemEditorMcpStorageFx {
	export interface Props {
		readonly root: string;
		readonly protectFx: (value: string) => Effect.Effect<Uint8Array, unknown>;
		readonly unprotectFx: (value: Uint8Array) => Effect.Effect<string, unknown>;
	}
}

/** Owns the installation-wide MCP configuration and recoverable OAuth state. */
export const createFilesystemEditorMcpStorageFx = Effect.fn("createFilesystemEditorMcpStorageFx")(
	function* ({ root, protectFx, unprotectFx }: createFilesystemEditorMcpStorageFx.Props) {
		const path = join(root, "mcp.json");
		const pendingPath = join(root, "mcp.pending");
		const write = (next: State) => {
			mkdirSync(root, {
				recursive: true,
			});
			const descriptor = openSync(pendingPath, "w", 0o600);
			try {
				writeFileSync(descriptor, JSON.stringify(serializeState(next)));
				fsyncSync(descriptor);
			} finally {
				closeSync(descriptor);
			}
			chmodSync(pendingPath, 0o600);
			renameSync(pendingPath, path);
		};
		let state: State | undefined;
		const readState = () => {
			if (state !== undefined) return state;
			let stored: string | undefined;
			try {
				stored = readFileSync(path, "utf8");
			} catch (cause) {
				if (!isMissing(cause)) throw cause;
			}
			let loaded: State;
			try {
				loaded = stored === undefined ? createState() : parseState(stored);
			} catch {
				loaded = createState();
				stored = undefined;
			}
			if (stored === undefined) write(loaded);
			else chmodSync(path, 0o600);
			state = loaded;
			return loaded;
		};
		const mutate = (change: (next: State) => void) => {
			const next = cloneState(readState());
			change(next);
			write(next);
			state = next;
		};
		const model: OAuthServerModel = {
			async getClient(clientId) {
				return readState().clients.get(clientId);
			},
			async registerClient(client: OAuthClientMetadata) {
				const registered = client as OAuthClientInformationFull;
				const clients = readState().clients;
				if (!clients.has(registered.client_id) && clients.size >= MaxEditorMcpClients)
					throw new Error("Remote MCP client limit reached. Reset auth to clear it.");
				mutate((next) => next.clients.set(registered.client_id, registered));
				return registered;
			},
			async saveAuthorizationCode(code) {
				mutate((next) => next.authorizationCodes.set(code.authorizationCode, code));
			},
			async consumeAuthorizationCode(token, clientId) {
				const code = readState().authorizationCodes.get(token);
				if (code?.clientId !== clientId) return undefined;
				mutate((next) => next.authorizationCodes.delete(token));
				return code;
			},
			async revokeAuthorizationCode(token) {
				if (!readState().authorizationCodes.has(token)) return;
				mutate((next) => next.authorizationCodes.delete(token));
			},
			async saveAccessToken(token) {
				mutate((next) => next.accessTokens.set(token.token, token));
			},
			async getAccessToken(token) {
				return readState().accessTokens.get(token);
			},
			async revokeAccessToken(token, clientId) {
				const accessToken = readState().accessTokens.get(token);
				if (accessToken?.clientId !== clientId) return undefined;
				mutate((next) => next.accessTokens.delete(token));
				return accessToken;
			},
			async saveRefreshToken(token) {
				mutate((next) => next.refreshTokens.set(token.token, token));
			},
			async consumeRefreshToken(token, clientId) {
				const refreshToken = readState().refreshTokens.get(token);
				if (refreshToken?.clientId !== clientId) return undefined;
				mutate((next) => next.refreshTokens.delete(token));
				return refreshToken;
			},
			async revokeRefreshToken(token, clientId) {
				const refreshToken = readState().refreshTokens.get(token);
				if (refreshToken?.clientId !== clientId) return undefined;
				mutate((next) => next.refreshTokens.delete(token));
				return refreshToken;
			},
			async revokeGrant(grantId) {
				const accessTokens = [
					...readState().accessTokens.values(),
				].filter((token) => token.grantId === grantId);
				const refreshTokens = [
					...readState().refreshTokens.values(),
				].filter((token) => token.grantId === grantId);
				if (accessTokens.length === 0 && refreshTokens.length === 0) return;
				mutate((next) => {
					for (const token of accessTokens) next.accessTokens.delete(token.token);
					for (const token of refreshTokens) next.refreshTokens.delete(token.token);
				});
			},
		};
		return {
			model,
			readPortFx: Effect.try({
				try: () => readState().port,
				catch: (cause) => cause,
			}),
			writePortFx: (port) =>
				Effect.try({
					try: () => {
						const parsed = EditorMcpPortSchema.parse(port);
						mutate((next) => {
							next.port = parsed;
						});
					},
					catch: (cause) => cause,
				}),
			readNgrokFx: Effect.gen(function* () {
				const ngrok = readState().ngrok;
				if (ngrok === undefined) return undefined;
				const authtoken = yield* unprotectFx(Buffer.from(ngrok.authtoken, "base64"));
				return yield* Effect.try({
					try: () =>
						EditorMcpNgrokSettingsSchema.parse({
							authtoken,
							domain: ngrok.domain,
						}),
					catch: (cause) => cause,
				});
			}).pipe(
				Effect.catch((cause) =>
					Effect.sync(() =>
						console.error(
							"Remote MCP ngrok configuration could not be read.",
							cause,
						),
					).pipe(Effect.as(undefined)),
				),
			),
			writeNgrokFx: (configuration) =>
				Effect.gen(function* () {
					const parsed = yield* Effect.try({
						try: () => EditorMcpNgrokSettingsSchema.parse(configuration),
						catch: (cause) => cause,
					});
					const protectedToken = yield* protectFx(parsed.authtoken);
					yield* Effect.try({
						try: () =>
							mutate((next) => {
								next.ngrok = {
									authtoken: Buffer.from(protectedToken).toString("base64"),
									domain: parsed.domain,
								};
							}),
						catch: (cause) => cause,
					});
				}),
			ensureSecretFx: Effect.try({
				try: () => readState().password,
				catch: (cause) => cause,
			}),
			verifySecretFx: (candidate) =>
				Effect.try({
					try: () => {
						const expected = Buffer.from(readState().password);
						const actual = Buffer.from(candidate);
						return (
							expected.length === actual.length && timingSafeEqual(expected, actual)
						);
					},
					catch: (cause) => cause,
				}),
			resetFx: Effect.try({
				try: () => {
					const current = readState();
					const next = createState(current.port, current.ngrok);
					write(next);
					state = next;
					return next.password;
				},
				catch: (cause) => cause,
			}),
		} satisfies EditorMcpStorage;
	},
);
