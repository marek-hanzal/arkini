import { Effect } from "effect";

import type { IdSchema } from "~/game-config/schema/IdSchema";
import { readOutputPlacementItemEventsFx } from "~/game-event/fx/readOutputPlacementItemEventsFx";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import { outputFx } from "~/production-output/fx/outputFx";
import { applyOutputPlacementFx } from "~/item-placement/fx/applyOutputPlacementFx";
import { removeRuntimeItemIdentityFx } from "~/game-runtime/fx/removeRuntimeItemIdentityFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { TypeSchema } from "~/item-definition/schema/TypeSchema";
import { makeTemporaryExpiryRandomFx } from "~/engine/item/temporary/random/makeTemporaryExpiryRandomFx";

export namespace completeTemporaryItemExpiryTransitionFx {
	export interface Props {
		itemId: IdSchema.Type;
		runtime: RuntimeSchema.Type;
	}

	export interface Result {
		readonly events: readonly GameEventSchema.Type[];
		readonly runtime: RuntimeSchema.Type;
	}
}

/** Removes one ready temporary item and returns exact expiry and output facts. */
export const completeTemporaryItemExpiryTransitionFx = Effect.fn(
	"completeTemporaryItemExpiryTransitionFx",
)(function* ({ itemId, runtime }: completeTemporaryItemExpiryTransitionFx.Props) {
	const item = runtime.items.find((candidate) => candidate.id === itemId);
	if (item === undefined)
		return yield* Effect.die(new Error(`Temporary item ${itemId} is missing.`));
	if (item.item.type !== TypeSchema.enum.Temporary) {
		return yield* Effect.die(new Error(`Runtime item ${item.id} is not temporary.`));
	}
	if (item.location.scope !== LocationScopeEnumSchema.enum.Board) {
		return yield* Effect.die(new Error(`Temporary item ${item.id} is not on the board.`));
	}
	if (item.remainingDurationMs !== 0) {
		return yield* Effect.die(new Error(`Temporary item ${item.id} is not ready to expire.`));
	}

	const expiredEvent = {
		type: GameEventEnumSchema.enum.ItemExpired,
		itemId: item.id,
		canonicalItemId: item.item.id,
		location: item.location,
		quantity: item.quantity,
	} satisfies GameEventSchema.Type;
	let draft: RuntimeSchema.Type = yield* removeRuntimeItemIdentityFx({
		item,
		runtime,
	});
	if (item.item.output === undefined) {
		return {
			events: [
				expiredEvent,
			],
			runtime: draft,
		} satisfies completeTemporaryItemExpiryTransitionFx.Result;
	}
	const origin = item.location;
	const configuredOutput = item.item.output;

	return yield* makeTemporaryExpiryRandomFx({
		item,
		program: Effect.gen(function* () {
			const output = yield* outputFx({
				origin,
				output: configuredOutput,
			});
			if (output.drop.length === 0) {
				return {
					events: [
						expiredEvent,
					],
					runtime: draft,
				} satisfies completeTemporaryItemExpiryTransitionFx.Result;
			}

			const [placement, withOutput] = yield* applyOutputPlacementFx({
				origin,
				output,
				runtime: draft,
			});
			draft = withOutput;
			const placementEvents = yield* readOutputPlacementItemEventsFx({
				originItemId: item.id,
				placement,
			});

			return {
				events: [
					expiredEvent,
					...placementEvents,
				],
				runtime: draft,
			} satisfies completeTemporaryItemExpiryTransitionFx.Result;
		}),
	});
});
