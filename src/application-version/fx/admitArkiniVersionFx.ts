import { Effect } from "effect";

import type { ArkiniVersionIncompatibleError } from "~/application-version/error/ArkiniVersionIncompatibleError";
import { readArkiniVersionIncompatibilityFn } from "~/application-version/fn/readArkiniVersionIncompatibilityFn";
import type { ArkiniVersionSchema } from "~/application-version/schema/ArkiniVersionSchema";

/** Admits structurally current persisted data solely by its Arkini writer major. */
export const admitArkiniVersionFx = Effect.fn("admitArkiniVersionFx")(function* (
	artifact: ArkiniVersionIncompatibleError["artifact"],
	writerVersion: ArkiniVersionSchema.Type,
) {
	const incompatibility = readArkiniVersionIncompatibilityFn(artifact, writerVersion);
	if (incompatibility !== undefined) return yield* Effect.fail(incompatibility);
});
