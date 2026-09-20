import { Effect } from "effect";

import type { SerakkiVersionIncompatibleError } from "~/application-version/error/SerakkiVersionIncompatibleError";
import { readSerakkiVersionIncompatibilityFn } from "~/application-version/fn/readSerakkiVersionIncompatibilityFn";
import type { SerakkiVersionSchema } from "~/application-version/schema/SerakkiVersionSchema";

/** Admits structurally current persisted data solely by its Serakki writer major. */
export const admitSerakkiVersionFx = Effect.fn("admitSerakkiVersionFx")(function* (
	artifact: SerakkiVersionIncompatibleError["artifact"],
	writerVersion: SerakkiVersionSchema.Type,
) {
	const incompatibility = readSerakkiVersionIncompatibilityFn(artifact, writerVersion);
	if (incompatibility !== undefined) return yield* Effect.fail(incompatibility);
});
