import { Effect, Option } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { PositiveIntegerSchema } from "~/game-value/schema/PositiveIntegerSchema";
import { readOutputPlacementItemEventsFx } from "~/game-event/fx/readOutputPlacementItemEventsFx";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import { releaseOwnerInputsFx } from "~/production-input/fx/releaseOwnerInputsFx";
import { ItemUnitsUnavailableError } from "~/production-action/error/ItemUnitsUnavailableError";
import { ItemNotOnGridError } from "~/item-location/error/ItemNotOnGridError";
import { isolateGridStatefulOwnerTransitionFx } from "~/item-state-isolation/fx/isolateGridStatefulOwnerTransitionFx";
import { readItemRemainingUnitsFn } from "~/production-action/fn/readItemRemainingUnitsFn";
import { outputFx } from "~/production-output/fx/outputFx";
import { applyOutputPlacementFx } from "~/item-placement/fx/applyOutputPlacementFx";
import { removeRuntimeItemIdentityFx } from "~/game-runtime/fx/removeRuntimeItemIdentityFx";
import { reviseRuntimeItemFx } from "~/game-runtime/fx/reviseRuntimeItemFx";
import { narrowGridRuntimeItemFn } from "~/game-runtime/fn/narrowGridRuntimeItemFn";
import { readRuntimeItemByIdFx } from "~/game-runtime/fx/readRuntimeItemByIdFx";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { makeActionUnitSpendRandomFx } from "./makeActionUnitSpendRandomFx";

export namespace spendActionUnitsFx {
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

/** Pays one resolved action unit and applies split, depletion, output, and events. */
export const spendActionUnitsFx = Effect.fn("spendActionUnitsFx")(function* ({
	actionId,
	cost,
	itemId,
	ownerItemId,
	runtime,
}: spendActionUnitsFx.Props) {
	const runtimeItem = yield* readRuntimeItemByIdFx({
		itemId,
		runtime,
	});
	const item = Option.getOrUndefined(narrowGridRuntimeItemFn(runtimeItem));
	if (item === undefined) {
		return yield* Effect.fail(
			new ItemNotOnGridError({
				itemId: runtimeItem.id,
				location: runtimeItem.location,
			}),
		);
	}

	const remainingUnits = readItemRemainingUnitsFn(item);
	if (remainingUnits === undefined || remainingUnits < cost) {
		return yield* Effect.fail(
			new ItemUnitsUnavailableError({
				itemId: item.id,
				cost,
				remainingUnits: remainingUnits ?? 0,
			}),
		);
	}

	const nextRemainingUnits = remainingUnits - cost;
	const activeJob = runtime.jobs.find((candidate) => candidate.ownerItemId === item.id);
	if (nextRemainingUnits > 0 || activeJob !== undefined) {
		const unitOwnerItem = yield* reviseRuntimeItemFx({
			item: {
				...item,
				remainingUnits: nextRemainingUnits,
			} satisfies RuntimeItemSchema.Type,
		});
		const spentRuntime = {
			...runtime,
			items: runtime.items.map((candidate) =>
				candidate.id === item.id ? unitOwnerItem : candidate,
			),
		} satisfies RuntimeSchema.Type;
		const isolation = yield* isolateGridStatefulOwnerTransitionFx({
			ownerItemId: item.id,
			runtime: spentRuntime,
		});
		return {
			events: [
				...(nextRemainingUnits === 0
					? []
					: [
							{
								type: GameEventEnumSchema.enum.ItemUnitSpent,
								itemId: item.id,
								canonicalItemId: item.item.id,
								location: item.location,
								previousUnits: remainingUnits,
								resultingUnits: nextRemainingUnits,
							} satisfies GameEventSchema.Type,
						]),
				...isolation.events,
			],
			runtime: isolation.runtime,
		} satisfies spendActionUnitsFx.Result;
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
	const depletionOutput = item.item.units?.output;
	if (depletionOutput !== undefined) {
		const [outputPlacement, withOutput] = yield* makeActionUnitSpendRandomFx({
			actionId,
			cost,
			itemId: item.id,
			ownerItemId,
			program: Effect.gen(function* () {
				const output = yield* outputFx({
					origin: item.location,
					output: depletionOutput,
				});
				return yield* applyOutputPlacementFx({
					origin: item.location,
					output,
					runtime: draft,
				});
			}),
			quantity: item.quantity,
			remainingUnits,
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
	} satisfies spendActionUnitsFx.Result;
});
