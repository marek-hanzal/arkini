import { Effect } from "effect";

import { GameEventEnumSchema } from "~/engine/event/schema/GameEventEnumSchema";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { readOutputPlacementItemEventsFx } from "~/engine/event/read/readOutputPlacementItemEventsFx";
import type { GameEventSchema } from "~/engine/event/schema/GameEventSchema";
import { ItemNotOnBoardError } from "~/engine/item/error/ItemNotOnBoardError";
import { isItemPureFx } from "~/engine/item/fx/purity/isItemPureFx";
import { applyOutputPlacementFx } from "~/engine/placement/fx/applyOutputPlacementFx";
import { reviseRuntimeItemFx } from "~/engine/runtime/fx/reviseRuntimeItemFx";
import { isBoardRuntimeItem } from "~/engine/runtime/read/isBoardRuntimeItem";
import { readRuntimeItemByIdFx } from "~/engine/runtime/read/readRuntimeItemByIdFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace isolateStatefulOwnerTransitionFx {
	export interface Props {
		ownerItemId: IdSchema.Type;
		runtime: RuntimeSchema.Type;
	}

	export interface Result {
		readonly events: readonly GameEventSchema.Type[];
		readonly runtime: RuntimeSchema.Type;
	}
}

/** Keeps one state-owning board identity and reports the exact placement of its pure remainder. */
export const isolateStatefulOwnerTransitionFx = Effect.fn("isolateStatefulOwnerTransitionFx")(
	function* ({ ownerItemId, runtime }: isolateStatefulOwnerTransitionFx.Props) {
		const owner = yield* readRuntimeItemByIdFx({
			itemId: ownerItemId,
			runtime,
		});
		if (!isBoardRuntimeItem(owner)) {
			return yield* Effect.fail(
				new ItemNotOnBoardError({
					itemId: owner.id,
					location: owner.location,
				}),
			);
		}
		if (owner.quantity === 1) {
			return {
				events: [],
				runtime,
			} satisfies isolateStatefulOwnerTransitionFx.Result;
		}

		const pure = yield* isItemPureFx({
			item: owner,
			runtime,
		});
		if (pure) {
			return yield* Effect.dieMessage(
				`Owner ${owner.id} must own identity-bound state before it can be isolated.`,
			);
		}

		const statefulOwner = yield* reviseRuntimeItemFx({
			item: {
				...owner,
				quantity: 1,
			},
		});
		const ownerRuntime = {
			...runtime,
			items: runtime.items.map((item) => (item.id === owner.id ? statefulOwner : item)),
		} satisfies RuntimeSchema.Type;
		const [placement, nextRuntime] = yield* applyOutputPlacementFx({
			origin: owner.location,
			output: {
				drop: [
					{
						itemId: owner.item.id,
						quantity: owner.quantity - 1,
						placement: "drop",
					},
				],
			},
			runtime: ownerRuntime,
		});
		const placementEvents = yield* readOutputPlacementItemEventsFx(placement);

		return {
			events: [
				{
					type: GameEventEnumSchema.enum.ItemSplit,
					itemId: owner.id,
					canonicalItemId: owner.item.id,
					location: owner.location,
					previousQuantity: owner.quantity,
					quantity: 1,
				},
				...placementEvents,
			],
			runtime: nextRuntime,
		} satisfies isolateStatefulOwnerTransitionFx.Result;
	},
);
