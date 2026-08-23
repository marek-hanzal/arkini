import { Effect } from "effect";

import { EditorProjectCompatibility } from "~/editor/version/EditorProjectCompatibility";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

/** Classifies one canonical config replacement against the save contracts it may restore. */
export const analyzeEditorProjectCompatibilityFx = Effect.fn("analyzeEditorProjectCompatibilityFx")(
	(previous: GameConfigSchema.Type, next: GameConfigSchema.Type) =>
		Effect.sync(() => EditorProjectCompatibility.analyze(previous, next)),
);
