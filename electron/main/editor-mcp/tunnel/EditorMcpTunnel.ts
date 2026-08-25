import type { Effect } from "effect";

export interface EditorMcpTunnelSession {
	readonly url: URL;
	readonly joinFx: Effect.Effect<void, unknown>;
	readonly closeFx: Effect.Effect<void, unknown>;
}

export interface EditorMcpTunnel {
	readonly openFx: (options: {
		readonly authtoken: string;
		readonly domain?: string;
		readonly port: number;
		readonly provenance: string;
	}) => Effect.Effect<EditorMcpTunnelSession, unknown>;
}
