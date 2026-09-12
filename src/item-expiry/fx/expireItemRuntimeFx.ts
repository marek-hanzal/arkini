import { Effect, Random } from "effect";
import type { OutputSchema } from "~/production-output/schema/OutputSchema";
import { outputFx } from "~/production-output/fx/outputFx";
import { applyOutputPlacementFx } from "~/item-placement/fx/applyOutputPlacementFx";
import { removeRuntimeItemIdentityFx } from "~/game-runtime/fx/removeRuntimeItemIdentityFx";
import { readOutputPlacementItemEventsFx } from "~/game-event/fx/readOutputPlacementItemEventsFx";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { RuntimeFx } from "~/game-runtime/context/RuntimeFx";

/** Common atomic identity expiry: detach, resolve against the input snapshot, then place output. */
export const expireItemRuntimeFx = Effect.fn("expireItemRuntimeFx")(function* ({
	item,
	origin,
	output,
	randomSeed,
	runtime,
}: {
	readonly item: RuntimeItemSchema.Type;
	readonly origin: BoardLocationSchema.Type;
	readonly output?: OutputSchema.Type;
	readonly randomSeed: string;
	readonly runtime: RuntimeSchema.Type;
}) {
	let draft = yield* removeRuntimeItemIdentityFx({
		item,
		runtime,
	});
	const events: GameEventSchema.Type[] = [
		{
			type: GameEventEnumSchema.enum.ItemExpired,
			itemId: item.id,
			canonicalItemId: item.item.id,
			location: origin,
			quantity: item.quantity,
		},
	];
	if (output !== undefined) {
		const placed = yield* Effect.gen(function* () {
			const resolved = yield* outputFx({
				origin,
				output,
			}).pipe(
				Effect.provideService(RuntimeFx, {
					read: Effect.succeed(runtime),
				}),
			);
			if (resolved.drop.length === 0)
				return {
					runtime: draft,
					events: [] as GameEventSchema.Type[],
				};
			const [placement, withOutput] = yield* applyOutputPlacementFx({
				origin,
				output: resolved,
				runtime: draft,
			});
			return {
				runtime: withOutput,
				events: yield* readOutputPlacementItemEventsFx({
					originItemId: item.id,
					placement,
				}),
			};
		}).pipe(Random.withSeed(randomSeed));
		draft = placed.runtime;
		events.push(...placed.events);
	}
	return {
		runtime: draft,
		events,
	};
});
