import { Effect, Random } from "effect";

import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";

/** Bump only when intentionally changing temporary-expiry random compatibility. */
export const TemporaryExpiryRandomVersion = 1;

/** Creates one deterministic random stream from one temporary runtime identity. */
export const makeTemporaryExpiryRandomFx = Effect.fn("makeTemporaryExpiryRandomFx")(function* ({
	item,
}: {
	item: RuntimeItemSchema.Type;
}) {
	return Random.make(
		[
			"arkini:temporary-expiry",
			`v${TemporaryExpiryRandomVersion}`,
			item.id,
			item.item.id,
		].join(":"),
	);
});
