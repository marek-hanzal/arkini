import { Effect, Random } from "effect";

import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";

/** Bump only when intentionally changing temporary-expiry random compatibility. */
const TemporaryExpiryRandomVersion = 2;

/** Runs the owned program with deterministic random from one temporary runtime identity. */
export const makeTemporaryExpiryRandomFx = Effect.fn("makeTemporaryExpiryRandomFx")(function* <
	Result,
	Error,
	Requirements,
>({
	item,
	program,
}: {
	item: RuntimeItemSchema.Type;
	program: Effect.Effect<Result, Error, Requirements>;
}) {
	return yield* program.pipe(
		Random.withSeed(
			[
				"arkini:temporary-expiry",
				`v${TemporaryExpiryRandomVersion}`,
				item.id,
				item.item.id,
			].join(":"),
		),
	);
});
