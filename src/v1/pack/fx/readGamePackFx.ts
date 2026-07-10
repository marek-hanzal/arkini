import { gunzipSync } from "fflate";
import { Effect } from "effect";

import { GameSchema } from "~/v1/schema/GameSchema";
import { decodeFx } from "./decodeFx";

/**
 * Reads a gzip-compressed Arkini game pack and validates its decoded game config.
 *
 * The binary transport and schema validation live together here so browser and
 * future runtime consumers cannot accidentally decode an unvalidated config.
 */
export const readGamePackFx = Effect.fn("readGamePackFx")(function* (bytes: Uint8Array) {
	const payload = yield* decodeFx(yield* Effect.sync(() => gunzipSync(bytes)));

	return {
		config: GameSchema.parse(payload.config),
		resources: payload.resources,
	} as const;
});
