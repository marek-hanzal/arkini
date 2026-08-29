import { Effect } from "effect";

import { validatePngResourceFx } from "~/renderer/arkpack/validatePngResourceFx";
import type { PayloadSchema } from "~/engine/pack/schema/PayloadSchema";
import type { GameSourceProvenanceSchema } from "~/engine/source/schema/GameSourceProvenanceSchema";
import { validateGameConfigFx } from "~/engine/validation/fx/validateGameConfigFx";
import { validateGameResourcesFx } from "~/engine/validation/rule/validateGameResourcesFx";

const createPackProvenance = (
	gameId: string,
	items: Readonly<Record<string, unknown>>,
): GameSourceProvenanceSchema.Type => {
	const source = `arkpack:${gameId}`;
	return {
		meta: source,
		resources: source,
		start: source,
		items: Object.fromEntries(
			Object.keys(items).map((id) => [
				id,
				source,
			]),
		),
	};
};

/** Runs the canonical completed-game validation shared by Arkpack read and build boundaries. */
export const validateArkpackPayloadFx = Effect.fn("validateArkpackPayloadFx")(function* (
	payload: Pick<PayloadSchema.Type, "config" | "resources">,
) {
	for (const resource of payload.resources) {
		yield* validatePngResourceFx(resource.bytes, resource.id);
	}
	const provenance = createPackProvenance(payload.config.meta.id, payload.config.items);
	return [
		...(yield* validateGameConfigFx({
			config: payload.config,
			provenance,
		})),
		...(yield* validateGameResourcesFx({
			config: payload.config,
			provenance,
			resources: payload.resources.map((resource) => ({
				id: resource.id,
				mime: "image/png" as const,
				path: `arkpack:${resource.id}`,
			})),
		})),
	];
});
