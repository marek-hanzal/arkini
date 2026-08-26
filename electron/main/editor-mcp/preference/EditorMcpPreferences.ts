import type { Effect } from "effect";

import type { EditorMcpNgrokSettingsSchema } from "../../../contract/editor/EditorMcpConfigurationSchema";
import type { EditorMcpPortSchema } from "../../../contract/editor/EditorMcpPortSchema";

export interface EditorMcpPreferences {
	readonly readPortFx: Effect.Effect<EditorMcpPortSchema.Type, unknown>;
	readonly writePortFx: (port: EditorMcpPortSchema.Type) => Effect.Effect<void, unknown>;
	readonly readNgrokFx: Effect.Effect<EditorMcpNgrokSettingsSchema.Type | undefined, unknown>;
	readonly writeNgrokFx: (
		configuration: EditorMcpNgrokSettingsSchema.Type,
	) => Effect.Effect<void, unknown>;
}
