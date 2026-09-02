import type { Effect } from "effect";

export interface McpTunnelSession {
	readonly url: URL;
	readonly closedFx: Effect.Effect<void, unknown, never>;
	readonly closeFx: Effect.Effect<void, unknown, never>;
}

export interface McpTunnel {
	readonly openFx: (options: {
		readonly authtoken: string;
		readonly domain: string;
		readonly port: number;
		readonly provenance: string;
	}) => Effect.Effect<McpTunnelSession, unknown, never>;
}
