import type { Effect } from "effect";

import type { EditorMcpPortSchema } from "../../../contract/editor/EditorMcpPortSchema";

export interface EditorMcpPreferences {
	readonly readPortFx: Effect.Effect<EditorMcpPortSchema.Type, unknown>;
	readonly writePortFx: (port: EditorMcpPortSchema.Type) => Effect.Effect<void, unknown>;
	readonly readNgrokAuthtokenFx: Effect.Effect<string | undefined, unknown>;
	readonly writeNgrokAuthtokenFx: (authtoken: string) => Effect.Effect<void, unknown>;
	readonly readNgrokDomainFx: Effect.Effect<string | undefined, unknown>;
	readonly writeNgrokDomainFx: (domain: string) => Effect.Effect<void, unknown>;
	readonly clearNgrokDomainFx: Effect.Effect<void, unknown>;
}
