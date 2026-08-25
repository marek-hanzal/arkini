import { Effect } from "effect";

import { ArkiniAppVersion } from "../../../shared/ArkiniAppMetadata";
import type { EditorProjectVersionApplicability } from "~/editor/version/EditorProjectVersion";

export const readEditorProjectVersionApplicability = (
	arkini: string,
): EditorProjectVersionApplicability =>
	arkini === ArkiniAppVersion
		? {
				type: "applicable",
			}
		: {
				type: "incompatible",
				reason: `Version was created by Arkini ${arkini}; Arkini ${ArkiniAppVersion} has no compatible snapshot migrator.`,
			};

/** Conservatively gates checkout until a future explicit cross-version migrator exists. */
export const readEditorProjectVersionApplicabilityFx = Effect.fn(
	"readEditorProjectVersionApplicabilityFx",
)((arkini: string) => Effect.succeed(readEditorProjectVersionApplicability(arkini)));
