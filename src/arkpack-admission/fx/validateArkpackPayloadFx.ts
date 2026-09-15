import { Effect } from "effect";

import { createArkpackSourceProvenanceFn } from "~/arkpack-admission/fn/createArkpackSourceProvenanceFn";
import { validatePngResourceFx } from "~/game-config-resource/fx/validatePngResourceFx";
import type { PayloadSchema } from "~/arkpack-artifact/schema/PayloadSchema";
import { validateGameConfigFx } from "~/game-config-validation/fx/validateGameConfigFx";
import { validateGameResourcesFn } from "~/game-config-validation/fn/validateGameResourcesFn";

/** Runs the canonical completed-game validation shared by Arkpack read and build boundaries. */
export const validateArkpackPayloadFx = Effect.fn("validateArkpackPayloadFx")(function* (
	payload: Pick<PayloadSchema.Type, "config" | "resources">,
) {
	for (const resource of payload.resources) {
		yield* validatePngResourceFx(resource.bytes, resource.id);
	}
	const provenance = createArkpackSourceProvenanceFn(
		payload.config.meta.id,
		payload.config.items,
	);
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
