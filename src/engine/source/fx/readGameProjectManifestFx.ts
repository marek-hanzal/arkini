import { Effect } from "effect";

import { GameProjectManifestSchema } from "~/engine/source/schema/GameProjectManifestSchema";
import { ArkiniVersionAdmission } from "~/engine/version/ArkiniVersionAdmission";
import { DiagnosticCodeEnumSchema } from "~/engine/validation/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/engine/validation/schema/DiagnosticSeverityEnumSchema";
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
			if (!parsed.success) return gameSourceSchemaDiagnostics(path, parsed.error);
			const incompatibility = ArkiniVersionAdmission.incompatibility(
				"Editor project",
				parsed.data.arkini,
			);
			return incompatibility === undefined
				? []
				: [
						{
							code: DiagnosticCodeEnumSchema.enum.SourceSchemaInvalid,
							severity: DiagnosticSeverityEnumSchema.enum.Error,
							path: [
								"arkini",
							],
							source: path,
							message: incompatibility.message,
							issueCode: "arkini-version-incompatible",
						},
					];
		},
	});
});
