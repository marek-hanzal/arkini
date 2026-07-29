import { Effect, Option } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { readOutputPlacementItemEventsFx } from "~/engine/event/read/readOutputPlacementItemEventsFx";
import { GameEventEnumSchema } from "~/engine/event/schema/GameEventEnumSchema";
import type { GameEventSchema } from "~/engine/event/schema/GameEventSchema";
import { outputFx } from "~/engine/output/fx/outputFx";
import { applyOutputPlacementFx } from "~/engine/placement/fx/applyOutputPlacementFx";
import { removeRuntimeItemIdentityFx } from "~/engine/runtime/fx/removeRuntimeItemIdentityFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";
import { makeTemporaryExpiryRandomFx } from "~/engine/item/temporary/random/makeTemporaryExpiryRandomFx";
import { readBoardRuntimeItemRectangleFx } from "~/engine/grid/fx/readBoardRuntimeItemRectangleFx";
import { isBoardRuntimeItemFx } from "~/engine/runtime/read/isBoardRuntimeItemFx";

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
	const runtimeItem = runtime.items.find((candidate) => candidate.id === itemId);
	if (runtimeItem === undefined)
		return yield* Effect.die(new Error(`Temporary item ${itemId} is missing.`));
	if (runtimeItem.item.type !== ItemEnumSchema.enum.Temporary) {
		return yield* Effect.die(new Error(`Runtime item ${runtimeItem.id} is not temporary.`));
	}
	const boardItem = Option.getOrUndefined(yield* isBoardRuntimeItemFx(runtimeItem));
	if (boardItem === undefined) {
		return yield* Effect.die(
			new Error(`Temporary item ${runtimeItem.id} is not on the board.`),
		);
	}
	if (runtimeItem.remainingDurationMs !== 0) {
		return yield* Effect.die(
			new Error(`Temporary item ${runtimeItem.id} is not ready to expire.`),
		);
	}
	const originRectangle = yield* readBoardRuntimeItemRectangleFx({
		item: boardItem,
	});

	const expiredEvent = {
		type: GameEventEnumSchema.enum.ItemExpired,
		itemId: runtimeItem.id,
		canonicalItemId: runtimeItem.item.id,
		location: boardItem.location,
		quantity: runtimeItem.quantity,
	} satisfies GameEventSchema.Type;
	let draft: RuntimeSchema.Type = yield* removeRuntimeItemIdentityFx({
		item: runtimeItem,
		runtime,
	});
	if (runtimeItem.item.output === undefined) {
		return {
			events: [
				expiredEvent,
			],
			runtime: draft,
		} satisfies completeTemporaryItemExpiryTransitionFx.Result;
	}
	const origin = boardItem.location;
	const configuredOutput = runtimeItem.item.output;

	return yield* makeTemporaryExpiryRandomFx({
		item: runtimeItem,
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
				originRectangle,
				output,
				runtime: draft,
			});
			draft = withOutput;
			const placementEvents = yield* readOutputPlacementItemEventsFx({
				originItemId: runtimeItem.id,
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
