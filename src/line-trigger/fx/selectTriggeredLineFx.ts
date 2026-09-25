import { Effect, Random } from "effect";
import { RuntimeFx } from "~/game-runtime/context/RuntimeFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import { resolveLineEnableFn } from "~/production-line/fn/resolveLineEnableFn";
import { lineRulesFx } from "~/production-line/fx/lineRulesFx";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import { LineTriggerEnumSchema } from "~/production-line/schema/LineTriggerEnumSchema";

/** Filters rules before one weighted draw; visibility and input admission do not bias the pool. */
export const selectTriggeredLineFx = Effect.fn("selectTriggeredLineFx")(function* ({
	item,
	runtime,
	trigger,
	origin,
	randomSeed,
}: {
	readonly item: RuntimeItemSchema.Type;
	readonly runtime: RuntimeSchema.Type;
	readonly trigger: LineTriggerEnumSchema.Type;
	readonly origin?: BoardLocationSchema.Type;
	readonly randomSeed: string;
}) {
	const boardOrigin = origin ?? (item.location.scope === "board" ? item.location : undefined);
	if (boardOrigin === undefined) return undefined;
	const pool: LineSchema.Type[] = [];
	for (const line of item.item.lines) {
		if (line.trigger !== trigger) continue;
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
	const totalWeight = pool.reduce((total, line) => total + line.weight, 0);
	let draw = yield* Random.nextBetween(0, totalWeight).pipe(Random.withSeed(randomSeed));
	for (const line of pool) {
		draw -= line.weight;
		if (draw < 0) return line;
	}
	return pool[pool.length - 1];
});
