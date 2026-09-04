import { Effect } from "effect";

import { validatePngResourceFx } from "~/game-config-resource/fx/validatePngResourceFx";
import type { PayloadSchema } from "~/arkpack-artifact/schema/PayloadSchema";
import type { GameSourceProvenanceSchema } from "~/game-config-source/schema/GameSourceProvenanceSchema";
import { validateGameConfigFx } from "~/game-config-validation/fx/validateGameConfigFx";
import { validateGameResourcesFn } from "~/game-config-validation/fn/validateGameResourcesFn";

const createPackProvenanceFn = (
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
	const provenance = createPackProvenanceFn(payload.config.meta.id, payload.config.items);
	return [
		...(yield* validateGameConfigFx({
			config: payload.config,
			provenance,
		})),
		...validateGameResourcesFn({
			config: payload.config,
			provenance,
			resources: payload.resources.map((resource) => ({
				id: resource.id,
				path: `arkpack:${resource.id}`,
			})),
		}),
	];
});
