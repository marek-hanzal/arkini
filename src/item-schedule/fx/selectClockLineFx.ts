import { Effect, Random } from "effect";
import { RuntimeFx } from "~/game-runtime/context/RuntimeFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import { readClockLinesFn } from "~/production-line/fn/readClockLinesFn";
import { resolveLineEnableFn } from "~/production-line/fn/resolveLineEnableFn";
import { lineRulesFx } from "~/production-line/fx/lineRulesFx";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import { LineClockModeEnumSchema } from "~/production-line/schema/LineClockModeEnumSchema";

/** Filters rules before drawing once; visibility and input admission do not bias the pool. */
export const selectClockLineFx = Effect.fn("selectClockLineFx")(function* ({
	item,
	runtime,
	role,
	origin,
}: {
	readonly item: RuntimeItemSchema.Type;
	readonly runtime: RuntimeSchema.Type;
	readonly role: LineClockModeEnumSchema.Type;
	readonly origin?: import("~/item-location/schema/BoardLocationSchema").BoardLocationSchema.Type;
}) {
	if (role === LineClockModeEnumSchema.enum["clock-interval"] && item.location.scope !== "board")
		return undefined;
	const boardOrigin = origin ?? (item.location.scope === "board" ? item.location : undefined);
	if (boardOrigin === undefined) return undefined;
	const pool: LineSchema.Type[] = [];
	for (const line of readClockLinesFn({
		item: item.item,
		schedule: item.schedule,
		role,
	})) {
		const rules = yield* lineRulesFx({
			origin: boardOrigin,
			rules: line.rules,
		}).pipe(
			Effect.provideService(RuntimeFx, {
				read: Effect.succeed(runtime),
			}),
		);
		if (
			resolveLineEnableFn({
				line,
				rules,
			})
		)
			pool.push(line);
	}
	if (pool.length < 2) return pool[0];
	const totalWeight = pool.reduce((total, line) => total + line.clockWeight, 0);
	// Owner identity and the saved pulse cursor survive hydration and Tick regrouping.
	let draw = yield* Random.nextBetween(0, totalWeight).pipe(
		Random.withSeed(
			[
				role === LineClockModeEnumSchema.enum["clock-lifetime"]
					? "serakki:clock-expiry:v1"
					: "serakki:clock:v1",
				item.id,
				item.item.uid,
				...(role === LineClockModeEnumSchema.enum["clock-interval"]
					? [
							item.schedule?.pulseSequence ?? 0,
						]
					: []),
			].join(":"),
		),
	);
	for (const line of pool) {
		draw -= line.clockWeight;
		if (draw < 0) return line;
	}
	return pool[pool.length - 1];
});
