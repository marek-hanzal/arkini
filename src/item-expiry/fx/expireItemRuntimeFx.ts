import { abortJobRuntimeFx } from "~/production-job/fx/abortJobRuntimeFx";
import { forceRemoveRuntimeItemFx } from "~/game-runtime/fx/forceRemoveRuntimeItemFx";
import { Effect, Random } from "effect";
import type { OutputSchema } from "~/production-output/schema/OutputSchema";
import { outputFx } from "~/production-output/fx/outputFx";
import { applyOutputPlacementFx } from "~/item-placement/fx/applyOutputPlacementFx";
import { removeRuntimeItemIdentityFx } from "~/game-runtime/fx/removeRuntimeItemIdentityFx";
import { readOutputPlacementItemEventsFx } from "~/game-event/fx/readOutputPlacementItemEventsFx";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { RuntimeFx } from "~/game-runtime/context/RuntimeFx";

/** Common atomic identity expiry: detach, resolve against the input snapshot, then place output. */
export const expireItemRuntimeFx = Effect.fn("expireItemRuntimeFx")(function* ({
	item,
	removalMode,
	origin,
	output,
	randomSeed,
	runtime,
}: {
	readonly item: RuntimeItemSchema.Type;
	readonly removalMode?: "kill-switch";
	readonly origin: GridLocationSchema.Type;
	readonly output?: OutputSchema.Type;
	readonly randomSeed: string;
	readonly runtime: RuntimeSchema.Type;
}) {
	const removal =
		removalMode === "kill-switch"
			? yield* forceRemoveRuntimeItemFx({
					item,
					origin,
					runtime,
				})
			: yield* removeRuntimeItemIdentityFx({
					item,
					runtime,
				});
	let draft = removal.runtime;
	let replacementPlaced = false;
	const events: GameEventSchema.Type[] = [
		...removal.events,
		{
			type: GameEventEnumSchema.enum.ItemExpired,
			itemId: item.id,
			canonicalItemId: item.item.id,
			location: origin,
			quantity: item.quantity,
		},
	];
	if (
		removalMode !== "kill-switch" &&
		(item.location.scope === "job" || item.location.scope === "reserved")
	) {
		const aborted = yield* abortJobRuntimeFx({
			reason: "material-expired",
			jobId: item.location.jobId,
			runtime: draft,
		}).pipe(
			Effect.provideService(RuntimeFx, {
				read: Effect.succeed(runtime),
			}),
		);
		draft = aborted.runtime;
		events.push(...aborted.events);
	}
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
					replacementPlaced: false,
				};
			const [placement, withOutput] = yield* applyOutputPlacementFx({
				overflow: removalMode === "kill-switch" ? "discard" : undefined,
				origin,
				output: resolved,
				runtime: draft,
			});
			const placementEvents = yield* readOutputPlacementItemEventsFx({
				originItemId: item.id,
				placement,
			});
			return {
				runtime: withOutput,
				events: [
					...placementEvents,
					...(placement.discarded ?? []).map(
						(loss): GameEventSchema.Type => ({
							type: GameEventEnumSchema.enum.ItemDiscarded,
							ownerItemId: item.id,
							canonicalItemId: loss.itemId,
							quantity: loss.quantity,
							source: "expiry-output",
							reason: loss.reason,
						}),
					),
				],
				replacementPlaced: placementEvents.length > 0,
			};
		}).pipe(Random.withSeed(randomSeed));
		draft = placed.runtime;
		events.push(...placed.events);
		replacementPlaced = placed.replacementPlaced;
	}
	const itemWasVisible = item.location.scope === LocationScopeEnumSchema.enum.Board;
	if (itemWasVisible && !replacementPlaced) {
		events.push({
			type: GameEventEnumSchema.enum.ItemDisappeared,
			itemId: item.id,
			canonicalItemId: item.item.id,
			location: origin,
			quantity: item.quantity,
		});
	}
	return {
		runtime: draft,
		events,
	};
});
