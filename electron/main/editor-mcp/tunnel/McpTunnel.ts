import type { Effect } from "effect";

export interface McpTunnelSession {
	readonly url: URL;
	readonly closedFx: Effect.Effect<void, unknown>;
	readonly closeFx: Effect.Effect<void, unknown>;
}

export interface McpTunnel {
	readonly openFx: (options: {
		readonly authtoken: string;
		readonly domain: string;
		readonly port: number;
		readonly provenance: string;
	}) => Effect.Effect<McpTunnelSession, unknown>;
}
