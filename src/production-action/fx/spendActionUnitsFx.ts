import { Effect, Option } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { PositiveIntegerSchema } from "~/game-value/schema/PositiveIntegerSchema";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import type { EngineFact } from "~/game-event/type/EngineFact";
import { releaseOwnerInputsFx } from "~/production-input/fx/releaseOwnerInputsFx";
import { ItemUnitsUnavailableError } from "~/production-action/error/ItemUnitsUnavailableError";
import { ItemNotOnGridError } from "~/item-location/error/ItemNotOnGridError";
import { readItemRemainingUnitsFn } from "~/production-action/fn/readItemRemainingUnitsFn";
import { resolveOutcomeTableFx } from "~/outcome/fx/resolveOutcomeTableFx";
import { applyOutcomeTableFx } from "~/outcome/fx/applyOutcomeTableFx";
import { removeRuntimeItemIdentityFx } from "~/game-runtime/fx/removeRuntimeItemIdentityFx";
import { reviseRuntimeItemFx } from "~/game-runtime/fx/reviseRuntimeItemFx";
import { narrowBoardRuntimeItemFn } from "~/game-runtime/fn/narrowBoardRuntimeItemFn";
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
		readonly facts: readonly EngineFact[];
		readonly runtime: RuntimeSchema.Type;
	}
}

/** Pays one resolved action unit and applies depletion, outcome, and events. */
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
	const item = Option.getOrUndefined(narrowBoardRuntimeItemFn(runtimeItem));
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
		return {
			facts: [
				...(nextRemainingUnits === 0
					? []
					: [
							{
								type: GameEventEnumSchema.enum.ItemUnitSpent,
								itemId: item.id,
								itemUid: item.item.uid,
								location: item.location,
								previousUnits: remainingUnits,
								resultingUnits: nextRemainingUnits,
							} satisfies GameEventSchema.Type,
						]),
			],
			runtime: spentRuntime,
		} satisfies spendActionUnitsFx.Result;
	}

	const depletedItem = yield* reviseRuntimeItemFx({
		item: {
			...item,
			remainingUnits: nextRemainingUnits,
		},
	});
	const removed = yield* removeRuntimeItemIdentityFx({
		item: depletedItem,
		runtime,
	});
	let draft = removed.runtime;
	const removalEvents = removed.events;

	let placement: applyOutcomeTableFx.Result = {
		effects: [],
		discarded: [],
	};
	const depletionOutcome = item.item.units?.outcome;
	if (depletionOutcome !== undefined) {
		const [outcomePlacement, withOutcome] = yield* makeActionUnitSpendRandomFx({
			actionId,
			cost,
			itemId: item.id,
			ownerItemId,
			program: Effect.gen(function* () {
				const outcome = yield* resolveOutcomeTableFx({
					ownerItemId: item.id,
					origin: item.location,
					outcome: depletionOutcome,
				});
				return yield* applyOutcomeTableFx({
					outcome,
					runtime: draft,
				});
			}),
			remainingUnits,
		});
		placement = outcomePlacement;
		draft = withOutcome;
	}

	let releasedInputEvents: readonly GameEventSchema.Type[] = [];
	{
		const releasedInputs = yield* releaseOwnerInputsFx({
			owner: item,
			origin: item.location,
			runtime: draft,
		});
		releasedInputEvents = releasedInputs.events;
		draft = releasedInputs.runtime;
	}
	const replacementItemIds = placement.effects.flatMap((effect) =>
		effect.type === "item" ? effect.placement.spawn.map((spawned) => spawned.id) : [],
	);
	return {
		facts: [
			{
				type: "lifecycle:settled",
				cause: "depleted",
				itemId: item.id,
				itemUid: item.item.uid,
				location: item.location,
				visible: true,
				replacementItemIds,
			} satisfies EngineFact,
			...removalEvents,
			...(placement.effects.length > 0
				? [
						{
							type: "outcome:applied",
							originItemId: item.id,
							effects: placement.effects,
						} satisfies EngineFact,
					]
				: []),
			...releasedInputEvents,
		],
		runtime: draft,
	} satisfies spendActionUnitsFx.Result;
});
