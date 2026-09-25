import { Effect, Option } from "effect";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { PositiveIntegerSchema } from "~/game-value/schema/PositiveIntegerSchema";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import type { EngineFact } from "~/game-event/type/EngineFact";
import { ItemUnitsUnavailableError } from "~/production-action/error/ItemUnitsUnavailableError";
import { ItemNotOnGridError } from "~/item-location/error/ItemNotOnGridError";
import { readItemRemainingUnitsFn } from "~/production-action/fn/readItemRemainingUnitsFn";
import { reviseRuntimeItemFx } from "~/game-runtime/fx/reviseRuntimeItemFx";
import { narrowBoardRuntimeItemFn } from "~/game-runtime/fn/narrowBoardRuntimeItemFn";
import { readRuntimeItemByIdFx } from "~/game-runtime/fx/readRuntimeItemByIdFx";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { attemptTerminalItemFx } from "~/item-terminal/fx/attemptTerminalItemFx";

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

/** Pays action units; the terminal pass owns depleted identity and selected work. */
export const spendActionUnitsFx = Effect.fn("spendActionUnitsFx")(function* ({
	cost,
	itemId,
	runtime,
}: spendActionUnitsFx.Props) {
	const runtimeItem = yield* readRuntimeItemByIdFx({
		itemId,
		runtime,
	});
	const item = Option.getOrUndefined(narrowBoardRuntimeItemFn(runtimeItem));
	if (item === undefined)
		return yield* Effect.fail(
			new ItemNotOnGridError({
				itemId: runtimeItem.id,
				location: runtimeItem.location,
			}),
		);
	const remainingUnits = readItemRemainingUnitsFn(item);
	if (remainingUnits === undefined || remainingUnits < cost)
		return yield* Effect.fail(
			new ItemUnitsUnavailableError({
				itemId: item.id,
				cost,
				remainingUnits: remainingUnits ?? 0,
			}),
		);
	const nextRemainingUnits = remainingUnits - cost;
	const spentItem = yield* reviseRuntimeItemFx({
		item: {
			...item,
			remainingUnits: nextRemainingUnits,
		} satisfies RuntimeItemSchema.Type,
	});
	const spentFacts = [
		{
			type: GameEventEnumSchema.enum.ItemUnitSpent,
			itemId: item.id,
			itemUid: item.item.uid,
			location: item.location,
			previousUnits: remainingUnits,
			resultingUnits: nextRemainingUnits,
		} satisfies GameEventSchema.Type,
	];
	const spentRuntime = {
		...runtime,
		items: runtime.items.map((candidate) => (candidate.id === item.id ? spentItem : candidate)),
	};
	if (nextRemainingUnits > 0)
		return {
			facts: spentFacts,
			runtime: spentRuntime,
		};
	const terminal = yield* attemptTerminalItemFx({
		itemId: item.id,
		runtime: spentRuntime,
	});
	if (terminal.type === "blocked") return yield* Effect.fail(terminal.error);
	return {
		facts: [
			...spentFacts,
			...terminal.facts,
		],
		runtime: terminal.runtime,
	} satisfies spendActionUnitsFx.Result;
});
