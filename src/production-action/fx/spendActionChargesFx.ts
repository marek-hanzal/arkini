import { Effect, Option } from "effect";

import type { IdSchema } from "~/game-config/schema/IdSchema";
import type { PositiveIntegerSchema } from "~/game-config/schema/PositiveIntegerSchema";
import { readOutputPlacementItemEventsFx } from "~/game-event/fx/readOutputPlacementItemEventsFx";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import { releaseOwnerInputsFx } from "~/production-input/fx/releaseOwnerInputsFx";
import { ItemChargesUnavailableError } from "~/engine/item/error/ItemChargesUnavailableError";
import { ItemNotOnGridError } from "~/item-location/error/ItemNotOnGridError";
import { isolateGridStatefulOwnerTransitionFx } from "~/engine/item/fx/isolateGridStatefulOwnerTransitionFx";
import { readItemRemainingChargesFn } from "~/engine/item/fn/readItemRemainingChargesFn";
import { outputFx } from "~/production-output/fx/outputFx";
import { applyOutputPlacementFx } from "~/item-placement/fx/applyOutputPlacementFx";
import { removeRuntimeItemIdentityFx } from "~/game-runtime/fx/removeRuntimeItemIdentityFx";
import { reviseRuntimeItemFx } from "~/game-runtime/fx/reviseRuntimeItemFx";
import { isGridRuntimeItemFn } from "~/game-runtime/read/fn/isGridRuntimeItemFn";
import { readRuntimeItemByIdFx } from "~/game-runtime/read/readRuntimeItemByIdFx";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { makeActionChargeSpendRandomFx } from "../random/makeActionChargeSpendRandomFx";

export namespace spendActionChargesFx {
	export interface Props {
		actionId: IdSchema.Type;
		cost: PositiveIntegerSchema.Type;
		itemId: IdSchema.Type;
		ownerItemId: IdSchema.Type;
		runtime: RuntimeSchema.Type;
	}

	export interface Result {
		readonly events: readonly GameEventSchema.Type[];
		readonly runtime: RuntimeSchema.Type;
	}
}

/** Pays one resolved action charge and applies split, depletion, output, and events. */
export const spendActionChargesFx = Effect.fn("spendActionChargesFx")(function* ({
	actionId,
	cost,
	itemId,
	ownerItemId,
	runtime,
}: spendActionChargesFx.Props) {
	const runtimeItem = yield* readRuntimeItemByIdFx({
		itemId,
		runtime,
	});
	const item = Option.getOrUndefined(isGridRuntimeItemFn(runtimeItem));
	if (item === undefined) {
		return yield* Effect.fail(
			new ItemNotOnGridError({
				itemId: runtimeItem.id,
				location: runtimeItem.location,
			}),
		);
	}

	const remainingCharges = readItemRemainingChargesFn(item);
	if (remainingCharges === undefined || remainingCharges < cost) {
		return yield* Effect.fail(
			new ItemChargesUnavailableError({
				itemId: item.id,
				cost,
				remainingCharges: remainingCharges ?? 0,
			}),
		);
	}

	const nextRemainingCharges = remainingCharges - cost;
	const activeJob = runtime.jobs.find((candidate) => candidate.ownerItemId === item.id);
	if (nextRemainingCharges > 0 || activeJob !== undefined) {
		const chargedItem = yield* reviseRuntimeItemFx({
			item: {
				...item,
				remainingCharges: nextRemainingCharges,
			} satisfies RuntimeItemSchema.Type,
		});
		const chargedRuntime = {
			...runtime,
			items: runtime.items.map((candidate) =>
				candidate.id === item.id ? chargedItem : candidate,
			),
		} satisfies RuntimeSchema.Type;
		const isolation = yield* isolateGridStatefulOwnerTransitionFx({
			ownerItemId: item.id,
			runtime: chargedRuntime,
		});
		return {
			events: [
				...(nextRemainingCharges === 0
					? []
					: [
							{
								type: GameEventEnumSchema.enum.ItemChargeSpent,
								itemId: item.id,
								canonicalItemId: item.item.id,
								location: item.location,
								previousCharges: remainingCharges,
								resultingCharges: nextRemainingCharges,
							} satisfies GameEventSchema.Type,
						]),
				...isolation.events,
			],
			runtime: isolation.runtime,
		} satisfies spendActionChargesFx.Result;
	}

	const resultingQuantity = item.quantity - 1;
	let draft: RuntimeSchema.Type;
	if (resultingQuantity > 0) {
		const remainingStack = yield* reviseRuntimeItemFx({
			item: {
				...item,
				quantity: resultingQuantity,
			} satisfies RuntimeItemSchema.Type,
		});
		draft = {
			...runtime,
			items: runtime.items.map((candidate) =>
				candidate.id === item.id ? remainingStack : candidate,
			),
		};
	} else {
		draft = yield* removeRuntimeItemIdentityFx({
			item,
			runtime,
		});
	}

	let placement: applyOutputPlacementFx.Result = {
		drop: [],
	};
	if (item.item.charges?.output !== undefined) {
		const output = yield* makeActionChargeSpendRandomFx({
			actionId,
			cost,
			itemId: item.id,
			ownerItemId,
			program: outputFx({
				origin: item.location,
				output: item.item.charges.output,
			}),
			quantity: item.quantity,
			remainingCharges,
		});
		const [outputPlacement, withOutput] = yield* applyOutputPlacementFx({
			origin: item.location,
			output,
			runtime: draft,
		});
		placement = outputPlacement;
		draft = withOutput;
	}

	let releasedInputEvents: readonly GameEventSchema.Type[] = [];
	if (resultingQuantity === 0) {
		const releasedInputs = yield* releaseOwnerInputsFx({
			owner: item,
			runtime: draft,
		});
		releasedInputEvents = releasedInputs.events;
		draft = releasedInputs.runtime;
	}
	const placementEvents = yield* readOutputPlacementItemEventsFx({
		originItemId: item.id,
		placement,
	});
	return {
		events: [
			{
				type: GameEventEnumSchema.enum.ItemDepleted,
				itemId: item.id,
				canonicalItemId: item.item.id,
				location: item.location,
				previousQuantity: item.quantity,
				resultingQuantity,
			} satisfies GameEventSchema.Type,
			...placementEvents,
			...releasedInputEvents,
		],
		runtime: draft,
	} satisfies spendActionChargesFx.Result;
});
