import { timingSafeEqual } from "node:crypto";
import { join } from "node:path";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { createId } from "@paralleldrive/cuid2";
import { Effect, FileSystem, Semaphore } from "effect";
import {
	OAuthClientInformationFullSchema,
	type AccessToken,
	type AuthorizationCode,
	type OAuthClientInformationFull,
	type OAuthClientMetadata,
	type OAuthServerModel,
	type RefreshToken,
} from "mcp-oauth-server";
import { z } from "zod";

/*
	OAuth records are library-owned protocol data, but the persisted collection and
	its identities are Arkini-owned. Parse the complete records before indexing them.
*/
const StoredDateSchema = z.iso
	.datetime()
	.transform((value) => new Date(value))
	.meta({
		id: "StoredDateSchema",
		description: "One persisted MCP OAuth timestamp decoded as a Date.",
	});
const StoredAuthorizationCodeSchema = z
	.object({
		authorizationCode: z.string().min(1),
		clientId: z.string().min(1),
		userId: z.string().min(1),
		expiresAt: StoredDateSchema,
		codeChallenge: z.string().min(1),
		redirectUri: z.string().min(1),
		state: z.string().optional(),
		scopes: z.array(z.string()).optional(),
		resource: z.string().optional(),
		grantId: z.string().optional(),
	})
	.strict()
	.meta({
		id: "StoredAuthorizationCodeSchema",
		description: "One complete persisted MCP OAuth authorization code.",
	});
const StoredAccessTokenSchema = z
	.object({
		token: z.string().min(1),
		expiresAt: StoredDateSchema,
		scopes: z.array(z.string()),
		clientId: z.string().min(1),
		userId: z.string().optional(),
		resource: z.string().optional(),
		grantId: z.string().optional(),
	})
	.strict()
	.meta({
		id: "StoredAccessTokenSchema",
		description: "One complete persisted MCP OAuth access token.",
	});
const StoredRefreshTokenSchema = StoredAccessTokenSchema.meta({
	id: "StoredRefreshTokenSchema",
	description: "One complete persisted MCP OAuth refresh token.",
});

import { EditorMcpNgrokSettingsSchema } from "../../../contract/editor/EditorMcpConfigurationSchema";
import { EditorMcpPortSchema } from "../../../contract/editor/EditorMcpPortSchema";
import type { McpStorage } from "./McpStorage";
import { ElectronMainRuntime } from "../../ElectronMainRuntime";
import { createFilesystemWriteFx } from "~/engine/filesystem/createFilesystemWriteFx";

export const DefaultPort = 32_310;
const MaxClients = 100;

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

const createState = (port = DefaultPort, ngrok?: StoredNgrok): State => ({
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

const indexedMap = <Value>(
	values: ReadonlyArray<Value>,
	readId: (value: Value) => string,
	label: string,
) => {
	const entries = values.map(
		(value) =>
			[
				readId(value),
				value,
			] as const,
	);
	if (new Set(entries.map(([id]) => id)).size !== entries.length)
		throw new Error(`Duplicate persisted ${label} identity.`);
	return new Map(entries);
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
	const clients = value.clients.map((client) => OAuthClientInformationFullSchema.parse(client));
	const authorizationCodes = value.authorizationCodes.map((code) =>
		StoredAuthorizationCodeSchema.parse(code),
	);
	const accessTokens = value.accessTokens.map((token) => StoredAccessTokenSchema.parse(token));
	const refreshTokens = value.refreshTokens.map((token) => StoredRefreshTokenSchema.parse(token));
	return {
		port,
		...(ngrok === undefined
			? {}
			: {
					ngrok,
				}),
		password: value.password,
		clients: indexedMap(clients, (client) => client.client_id, "OAuth client"),
		authorizationCodes: indexedMap(
			authorizationCodes,
			(code) => code.authorizationCode,
			"authorization code",
		),
		accessTokens: indexedMap(accessTokens, (token) => token.token, "access token"),
		refreshTokens: indexedMap(refreshTokens, (token) => token.token, "refresh token"),
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

export namespace createFilesystemEditorMcpStorageFx {
	export interface Props {
		readonly root: string;
		readonly fileSystem?: FileSystem.FileSystem;
		readonly protectFx: (value: string) => Effect.Effect<Uint8Array, unknown>;
		readonly unprotectFx: (value: Uint8Array) => Effect.Effect<string, unknown>;
	}
}

const createStorageFx = Effect.fn("createFilesystemEditorMcpStorageFx")(function* ({
	root,
	fileSystem: providedFileSystem,
	protectFx,
	unprotectFx,
}: createFilesystemEditorMcpStorageFx.Props) {
	const path = join(root, "mcp.json");
	const lock = join(root, ".mcp.lock");
	const fileSystem = providedFileSystem ?? (yield* FileSystem.FileSystem);
	const filesystemWrite = yield* createFilesystemWriteFx().pipe(
		Effect.provideService(FileSystem.FileSystem, fileSystem),
	);
	const operations = yield* Semaphore.make(1);
	let state: State | undefined;
	const writeStateFx = (next: State) =>
		filesystemWrite.replaceFileFx({
			lock,
			target: path,
			bytes: new TextEncoder().encode(JSON.stringify(serializeState(next))),
		});
	const readDiskFx = Effect.gen(function* () {
		const stored = (yield* fileSystem.exists(path))
			? yield* fileSystem.readFileString(path)
			: undefined;
		let rewrite = stored === undefined;
		let loaded: State;
		try {
			loaded = stored === undefined ? createState() : parseState(stored);
		} catch {
			loaded = createState();
			rewrite = true;
		}
		if (rewrite) yield* writeStateFx(loaded);
		state = loaded;
		return loaded;
	});
	const loadFx = Effect.suspend(() =>
		state === undefined ? filesystemWrite.withLockFx(lock, readDiskFx) : Effect.succeed(state),
	);
	const readStateFx = operations.withPermits(1)(loadFx);
	const mutateFx = (change: (next: State) => void) =>
		operations.withPermits(1)(
			filesystemWrite.withLockFx(
				lock,
				Effect.gen(function* () {
					const next = cloneState(yield* readDiskFx);
					yield* Effect.sync(() => change(next));
					yield* writeStateFx(next);
					state = next;
				}),
			),
		);
	const runPromise = <Value>(effect: Effect.Effect<Value, unknown>) =>
		ElectronMainRuntime.runPromise(effect);
	const model: OAuthServerModel = {
		async getClient(clientId) {
			return (await runPromise(readStateFx)).clients.get(clientId);
		},
		async registerClient(client: OAuthClientMetadata) {
			const registered = OAuthClientInformationFullSchema.parse(client);
			await runPromise(
				mutateFx((next) => {
					if (!next.clients.has(registered.client_id) && next.clients.size >= MaxClients)
						throw new Error("Remote MCP client limit reached. Reset auth to clear it.");
					next.clients.set(registered.client_id, registered);
				}),
			);
			return registered;
		},
		async saveAuthorizationCode(code) {
			await runPromise(
				mutateFx((next) => next.authorizationCodes.set(code.authorizationCode, code)),
			);
		},
		async consumeAuthorizationCode(token, clientId) {
			let consumed: AuthorizationCode | undefined;
			await runPromise(
				mutateFx((next) => {
					const code = next.authorizationCodes.get(token);
					if (code?.clientId !== clientId) return;
					consumed = code;
					next.authorizationCodes.delete(token);
				}),
			);
			return consumed;
		},
		async revokeAuthorizationCode(token) {
			await runPromise(mutateFx((next) => next.authorizationCodes.delete(token)));
		},
		async saveAccessToken(token) {
			await runPromise(mutateFx((next) => next.accessTokens.set(token.token, token)));
		},
		async getAccessToken(token) {
			return (await runPromise(readStateFx)).accessTokens.get(token);
		},
		async revokeAccessToken(token, clientId) {
			let revoked: AccessToken | undefined;
			await runPromise(
				mutateFx((next) => {
					const accessToken = next.accessTokens.get(token);
					if (accessToken?.clientId !== clientId) return;
					revoked = accessToken;
					next.accessTokens.delete(token);
				}),
			);
			return revoked;
		},
		async saveRefreshToken(token) {
			await runPromise(mutateFx((next) => next.refreshTokens.set(token.token, token)));
		},
		async consumeRefreshToken(token, clientId) {
			let consumed: RefreshToken | undefined;
			await runPromise(
				mutateFx((next) => {
					const refreshToken = next.refreshTokens.get(token);
					if (refreshToken?.clientId !== clientId) return;
					consumed = refreshToken;
					next.refreshTokens.delete(token);
				}),
			);
			return consumed;
		},
		async revokeRefreshToken(token, clientId) {
			let revoked: RefreshToken | undefined;
			await runPromise(
				mutateFx((next) => {
					const refreshToken = next.refreshTokens.get(token);
					if (refreshToken?.clientId !== clientId) return;
					revoked = refreshToken;
					next.refreshTokens.delete(token);
				}),
			);
			return revoked;
		},
		async revokeGrant(grantId) {
			await runPromise(
				mutateFx((next) => {
					for (const token of next.accessTokens.values())
						if (token.grantId === grantId) next.accessTokens.delete(token.token);
					for (const token of next.refreshTokens.values())
						if (token.grantId === grantId) next.refreshTokens.delete(token.token);
				}),
			);
		},
	};
	return {
		model,
		readPortFx: readStateFx.pipe(Effect.map((current) => current.port)),
		writePortFx: (port) =>
			Effect.gen(function* () {
				const parsed = yield* Effect.try({
					try: () => EditorMcpPortSchema.parse(port),
					catch: (cause) => cause,
				});
				yield* mutateFx((next) => {
					next.port = parsed;
				});
			}),
		readNgrokFx: Effect.gen(function* () {
			const ngrok = (yield* readStateFx).ngrok;
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
					console.error("Remote MCP ngrok configuration could not be read.", cause),
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
				yield* mutateFx((next) => {
					next.ngrok = {
						authtoken: Buffer.from(protectedToken).toString("base64"),
						domain: parsed.domain,
					};
				});
			}),
		ensureSecretFx: readStateFx.pipe(Effect.map((current) => current.password)),
		verifySecretFx: (candidate) =>
			Effect.gen(function* () {
				const password = (yield* readStateFx).password;
				return yield* Effect.try({
					try: () => {
						const expected = Buffer.from(password);
						const actual = Buffer.from(candidate);
						return (
							expected.length === actual.length && timingSafeEqual(expected, actual)
						);
					},
					catch: (cause) => cause,
				});
			}),
		resetFx: operations.withPermits(1)(
			filesystemWrite.withLockFx(
				lock,
				Effect.gen(function* () {
					const current = yield* readDiskFx;
					const next = createState(current.port, current.ngrok);
					yield* writeStateFx(next);
					state = next;
					return next.password;
				}),
			),
		),
	} satisfies McpStorage;
});

/** Owns the installation-wide MCP configuration and atomically replaced OAuth state. */
export const createFilesystemEditorMcpStorageFx = (
	props: createFilesystemEditorMcpStorageFx.Props,
) => createStorageFx(props).pipe(Effect.provide(NodeServices.layer));
