import { abortJobRuntimeFx } from "~/production-job/fx/abortJobRuntimeFx";
import { forceRemoveRuntimeItemFx } from "~/game-runtime/fx/forceRemoveRuntimeItemFx";
import { Effect, Random } from "effect";
import type { OutcomeTableSchema } from "~/outcome/schema/OutcomeTableSchema";
import { resolveOutcomeTableFx } from "~/outcome/fx/resolveOutcomeTableFx";
import { applyOutcomeTableFx } from "~/outcome/fx/applyOutcomeTableFx";
import { removeRuntimeItemIdentityFx } from "~/game-runtime/fx/removeRuntimeItemIdentityFx";
import { readOutcomePlacementItemEventsFx } from "~/game-event/fx/readOutcomePlacementItemEventsFx";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { RuntimeFx } from "~/game-runtime/context/RuntimeFx";

/** Common atomic identity expiry: detach, resolve against the input snapshot, then place outcome. */
export const expireItemRuntimeFx = Effect.fn("expireItemRuntimeFx")(function* ({
	item,
	removalMode,
	origin,
	outcome,
	randomSeed,
	runtime,
}: {
	readonly item: RuntimeItemSchema.Type;
	readonly removalMode?: "kill-switch";
	readonly origin: BoardLocationSchema.Type;
	readonly outcome?: OutcomeTableSchema.Type;
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
			itemUid: item.item.uid,
			location: origin,
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
	if (outcome !== undefined) {
		const placed = yield* Effect.gen(function* () {
			const resolved = yield* resolveOutcomeTableFx({
				ownerItemId: item.id,
				origin,
				outcome,
			});
			if (resolved.roll.length === 0)
				return {
					runtime: draft,
					events: [] as GameEventSchema.Type[],
					replacementPlaced: false,
				};
			const [placement, withOutcome] = yield* applyOutcomeTableFx({
				overflow: removalMode === "kill-switch" ? "discard" : undefined,
				outcome: resolved,
				runtime: draft,
			});
			const placementEvents = yield* readOutcomePlacementItemEventsFx({
				originItemId: item.id,
				placement,
			});
			return {
				runtime: withOutcome,
				events: [
					...placementEvents,
					...(placement.discarded ?? []).map(
						(loss): GameEventSchema.Type => ({
							type: GameEventEnumSchema.enum.ItemDiscarded,
							ownerItemId: item.id,
							itemUid: loss.itemUid,
							quantity: loss.quantity,
							source: "expiry-outcome",
							reason: loss.reason,
						}),
					),
				],
				replacementPlaced: placement.item.some(
					({ placement: { spawn } }) => spawn.length > 0,
				),
			};
		}).pipe(
			Effect.provideService(RuntimeFx, {
				read: Effect.succeed(runtime),
			}),
			Random.withSeed(randomSeed),
		);
		draft = placed.runtime;
		events.push(...placed.events);
		replacementPlaced = placed.replacementPlaced;
	}
	const itemWasVisible = item.location.scope === LocationScopeEnumSchema.enum.Board;
	if (itemWasVisible && !replacementPlaced) {
		events.push({
			type: GameEventEnumSchema.enum.ItemDisappeared,
			itemId: item.id,
			itemUid: item.item.uid,
			location: origin,
		});
	}
	return {
		runtime: draft,
		events,
	};
});
