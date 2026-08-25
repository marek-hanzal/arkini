import type { Effect } from "effect";
import type { OAuthServerModel } from "mcp-oauth-server";

export interface EditorMcpAuthOwnership {
	readonly model: OAuthServerModel;
	readonly readConfiguredFx: Effect.Effect<boolean, unknown>;
	readonly ensureSecretFx: Effect.Effect<string | undefined, unknown>;
	readonly verifySecretFx: (candidate: string) => Effect.Effect<boolean, unknown>;
	readonly resetFx: Effect.Effect<string, unknown>;
	readonly closeFx: Effect.Effect<void, unknown>;
}
