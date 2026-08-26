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
				reason: `Version was created by Arkini ${arkini}; this build is Arkini ${ArkiniAppVersion}.`,
			};

/** Keeps version checkout pinned to this exact Arkini build contract. */
export const readEditorProjectVersionApplicabilityFx = Effect.fn(
	"readEditorProjectVersionApplicabilityFx",
)((arkini: string) => Effect.succeed(readEditorProjectVersionApplicability(arkini)));
