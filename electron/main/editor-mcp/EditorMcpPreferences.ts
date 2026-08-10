import type { Effect } from "effect";

import type { EditorMcpPortSchema } from "../../contract/editor/EditorMcpPortSchema";

export interface EditorMcpPreferences {
	readonly readPortFx: Effect.Effect<EditorMcpPortSchema.Type, unknown>;
	readonly writePortFx: (port: EditorMcpPortSchema.Type) => Effect.Effect<void, unknown>;
}
