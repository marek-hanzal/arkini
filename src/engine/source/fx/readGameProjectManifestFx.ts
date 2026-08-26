import { Effect } from "effect";

import { GameProjectManifestSchema } from "~/engine/source/schema/GameProjectManifestSchema";
import {
	gameSourceSchemaDiagnostics,
	readRequiredGameProjectJsonFx,
} from "./readRequiredGameProjectJsonFx";

/** Validates the manifest that selects the portable game-project source format. */
export const readGameProjectManifestFx = Effect.fn("readGameProjectManifestFx")(function* (
	path: string,
) {
	return yield* readRequiredGameProjectJsonFx({
		path,
		missingIssueCode: "game-project-manifest-missing",
		missingMessage: "The required game project manifest could not be read.",
		validate: (json) => {
			const parsed = GameProjectManifestSchema.safeParse(json);
			return parsed.success ? [] : gameSourceSchemaDiagnostics(path, parsed.error);
		},
	});
});
