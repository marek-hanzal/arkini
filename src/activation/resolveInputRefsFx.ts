import { Effect } from "effect";
import { match } from "ts-pattern";
import type { GameActionItemRefSchema } from "~/action/GameActionItemRefSchema";
import type { GameActionResolvedInputRef } from "~/action/GameActionResolvedInputRef";
import { readGameSaveBoardItemQuantity } from "~/board/readGameSaveBoardItemQuantity";
import { isBoardItemConsumableAsInput } from "~/activation/isBoardItemConsumableAsInput";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { readGameSaveInventorySlotQuantity } from "~/inventory/model/GameSaveInventorySlot";

export namespace resolveInputRefsFx {
	export interface Props {
		save: GameSave;
		inputRefs: readonly GameActionItemRefSchema.Type[];
	}
}

const assertUniqueInputRefFx = Effect.fn("resolveInputRefsFx.assertUniqueInputRefFx")(function* ({
	key,
	seen,
}: {
	key: string;
	seen: Set<string>;
}) {
	if (!seen.has(key)) {
		seen.add(key);
		return;
	}

	return yield* Effect.fail(
		GameEngineError.actionRejected("input_mismatch", `Duplicate input ref "${key}".`),
	);
});

const resolveBoardInputRefFx = Effect.fn("resolveInputRefsFx.resolveBoardInputRefFx")(function* ({
	itemInstanceId,
	quantity = 1,
	save,
	seen,
}: Extract<
	GameActionItemRefSchema.Type,
	{
		kind: "board";
	}
> & {
	save: GameSave;
	seen: Set<string>;
}) {
	const key = `board:${itemInstanceId}`;
	yield* assertUniqueInputRefFx({
		key,
		seen,
	});

	const item = save.board.items[itemInstanceId];
	if (!item) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"input_unavailable",
				`Missing board input "${itemInstanceId}".`,
			),
		);
	}

	if (readGameSaveBoardItemQuantity(item) < quantity) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"input_unavailable",
				`Board input "${itemInstanceId}" does not have enough quantity.`,
			),
		);
	}

	if (
		!isBoardItemConsumableAsInput({
			itemInstanceId,
			save,
		})
	) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"item_busy",
				`Board input "${itemInstanceId}" has runtime state and cannot be consumed as input.`,
			),
		);
	}

	return {
		kind: "board" as const,
		itemId: item.itemId,
		itemInstanceId: item.id,
		quantity,
	} satisfies GameActionResolvedInputRef;
});

const resolveInventoryInputRefFx = Effect.fn("resolveInputRefsFx.resolveInventoryInputRefFx")(
	function* ({
		quantity,
		save,
		seen,
		slotIndex,
	}: Extract<
		GameActionItemRefSchema.Type,
		{
			kind: "inventory";
		}
	> & {
		save: GameSave;
		seen: Set<string>;
	}) {
		const key = `inventory:${slotIndex}`;
		yield* assertUniqueInputRefFx({
			key,
			seen,
		});

		const slot = save.inventory.slots[slotIndex];
		if (!slot || readGameSaveInventorySlotQuantity(slot) < quantity) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"input_unavailable",
					`Missing inventory input at slot ${slotIndex}.`,
				),
			);
		}

		return {
			kind: "inventory" as const,
			itemId: slot.itemId,
			quantity,
			slotIndex,
		} satisfies GameActionResolvedInputRef;
	},
);

const resolveInputRefFx = Effect.fn("resolveInputRefsFx.resolveInputRefFx")(function* ({
	ref,
	save,
	seen,
}: {
	ref: GameActionItemRefSchema.Type;
	save: GameSave;
	seen: Set<string>;
}) {
	return yield* match(ref)
		.with(
			{
				kind: "board",
			},
			(boardRef) =>
				resolveBoardInputRefFx({
					...boardRef,
					save,
					seen,
				}),
		)
		.with(
			{
				kind: "inventory",
			},
			(inventoryRef) =>
				resolveInventoryInputRefFx({
					...inventoryRef,
					save,
					seen,
				}),
		)
		.exhaustive();
});

export const resolveInputRefsFx = Effect.fn("resolveInputRefsFx")(function* ({
	inputRefs,
	save,
}: resolveInputRefsFx.Props) {
	const seen = new Set<string>();
	const resolved: GameActionResolvedInputRef[] = [];
	for (const ref of inputRefs) {
		resolved.push(
			yield* resolveInputRefFx({
				ref,
				save,
				seen,
			}),
		);
	}
	return resolved;
});
