import { abortJobRuntimeFx } from "~/production-job/fx/abortJobRuntimeFx";
import { forceRemoveRuntimeItemFx } from "~/game-runtime/fx/forceRemoveRuntimeItemFx";
import { Effect, Random } from "effect";
import type { OutcomeTableSchema } from "~/outcome/schema/OutcomeTableSchema";
import { resolveOutcomeTableFx } from "~/outcome/fx/resolveOutcomeTableFx";
import { applyOutcomeTableFx } from "~/outcome/fx/applyOutcomeTableFx";
import type { AppliedOutcome } from "~/outcome/type/AppliedOutcome";
import { removeRuntimeItemIdentityFx } from "~/game-runtime/fx/removeRuntimeItemIdentityFx";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import type { EngineFact } from "~/game-event/type/EngineFact";
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
	const removalFacts = "facts" in removal ? removal.facts : removal.events;
	let draft = removal.runtime;
	let abortedFacts: readonly EngineFact[] = [];
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
		abortedFacts = aborted.facts;
	}
	let outcomeEffects: readonly AppliedOutcome[] = [];
	let outcomeDiscarded: readonly GameEventSchema.Type[] = [];
	if (outcome !== undefined) {
		const placed = yield* Effect.gen(function* () {
			const resolved = yield* resolveOutcomeTableFx({
				origin,
				outcome,
			});
			if (resolved.roll.length === 0)
				return {
					runtime: draft,
					effects: [] as readonly AppliedOutcome[],
					discarded: [] as readonly GameEventSchema.Type[],
				};
			const [placement, withOutcome] = yield* applyOutcomeTableFx({
				overflow: removalMode === "kill-switch" ? "discard" : undefined,
				outcome: resolved,
				runtime: draft,
			});
			return {
				runtime: withOutcome,
				effects: placement.effects,
				discarded: (placement.discarded ?? []).map(
					(loss): GameEventSchema.Type => ({
						type: GameEventEnumSchema.enum.ItemDiscarded,
						ownerItemId: item.id,
						itemUid: loss.itemUid,
						quantity: loss.quantity,
						source: "expiry-outcome",
						reason: loss.reason,
					}),
				),
			};
		}).pipe(
			Effect.provideService(RuntimeFx, {
				read: Effect.succeed(runtime),
			}),
			Random.withSeed(randomSeed),
		);
		draft = placed.runtime;
		outcomeEffects = placed.effects;
		outcomeDiscarded = placed.discarded;
	}
	const itemWasVisible = item.location.scope === LocationScopeEnumSchema.enum.Board;
	const replacementItemIds = outcomeEffects.flatMap((effect) =>
		effect.type === "item" ? effect.placement.spawn.map((spawned) => spawned.id) : [],
	);
	return {
		runtime: draft,
		facts: [
			...removalFacts,
			{
				type: "lifecycle:settled",
				cause: "expired",
				itemId: item.id,
				itemUid: item.item.uid,
				location: origin,
				visible: itemWasVisible,
				replacementItemIds,
			} satisfies EngineFact,
			...abortedFacts,
			...(outcomeEffects.length > 0
				? [
						{
							type: "outcome:applied",
							originItemId: item.id,
							effects: outcomeEffects,
						} satisfies EngineFact,
					]
				: []),
			...outcomeDiscarded,
		],
	};
});
