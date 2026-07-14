import { Effect } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import { applyOutputPlacementFx } from "~/v1/placement/fx/applyOutputPlacementFx";
import { reviseRuntimeItemFx } from "~/v1/runtime/fx/reviseRuntimeItemFx";
import { isBoardRuntimeItem } from "~/v1/runtime/read/isBoardRuntimeItem";
import { readRuntimeItemByIdFx } from "~/v1/runtime/read/readRuntimeItemByIdFx";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

export namespace splitCraftOwnerForStartFx {
	export interface Props {
		ownerItemId: IdSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/**
 * Detaches every excess craft quantity through standard placement before one unit starts work.
 */
export const splitCraftOwnerForStartFx = Effect.fn("splitCraftOwnerForStartFx")(function* ({
	ownerItemId,
	runtime,
}: splitCraftOwnerForStartFx.Props) {
	const owner = yield* readRuntimeItemByIdFx({
		itemId: ownerItemId,
		runtime,
	});
	if (owner.item.type !== "craft" || owner.quantity === 1) {
		return runtime;
	}
	if (!isBoardRuntimeItem(owner)) {
		return yield* Effect.dieMessage(
			`Craft owner ${owner.id} left the board after its start plan was accepted.`,
		);
	}

	const runningOwner = yield* reviseRuntimeItemFx({
		item: {
			...owner,
			quantity: 1,
		},
	});
	const ownerRuntime = {
		...runtime,
		items: runtime.items.map((item) => (item.id === owner.id ? runningOwner : item)),
	} satisfies RuntimeSchema.Type;
	const excludedStackItemIds = [
		owner.id,
		...runtime.jobs.map((job) => job.ownerItemId),
	];
	const [, nextRuntime] = yield* applyOutputPlacementFx({
		excludedStackItemIds,
		origin: owner.location.position,
		originItemId: owner.id,
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

	return nextRuntime;
});
