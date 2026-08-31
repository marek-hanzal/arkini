import type { Effect } from "effect";
import type { OAuthServerModel } from "mcp-oauth-server";

import type { EditorMcpNgrokSettingsSchema } from "~electron/contract/editor/EditorMcpConfigurationSchema";
import type { EditorMcpPortSchema } from "~electron/contract/editor/EditorMcpPortSchema";

export interface McpStorage {
	readonly model: OAuthServerModel;
	readonly readPortFx: Effect.Effect<EditorMcpPortSchema.Type, unknown, never>;
	readonly writePortFx: (port: EditorMcpPortSchema.Type) => Effect.Effect<void, unknown, never>;
	readonly readNgrokFx: Effect.Effect<
		EditorMcpNgrokSettingsSchema.Type | undefined,
		unknown,
		never
	>;
	readonly writeNgrokFx: (
		configuration: EditorMcpNgrokSettingsSchema.Type,
	) => Effect.Effect<void, unknown, never>;
	readonly ensureSecretFx: Effect.Effect<string, unknown, never>;
	readonly verifySecretFx: (candidate: string) => Effect.Effect<boolean, unknown, never>;
	readonly resetFx: Effect.Effect<string, unknown, never>;
}
