import { Effect } from "effect";
import { match } from "ts-pattern";
import type { GameActionItemRefSchema } from "~/v0/game/engine/model/GameActionItemRefSchema";
import type { GameActionResolvedInputRef } from "~/v0/game/engine/model/GameActionResolvedInputRef";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import { readGameSaveInventorySlotQuantity } from "~/v0/game/engine/model/GameSaveInventorySlot";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace resolveInputRefsFx {
	export interface Props {
		save: GameSave;
		inputRefs: readonly GameActionItemRefSchema.Type[];
	}
}

export const resolveInputRefsFx = Effect.fn("resolveInputRefsFx")(function* ({
	save,
	inputRefs,
}: resolveInputRefsFx.Props) {
	const resolved: GameActionResolvedInputRef[] = [];
	const seen = new Set<string>();

	for (const ref of inputRefs) {
		yield* match(ref)
			.with(
				{
					kind: "board",
				},
				(boardRef) =>
					Effect.gen(function* () {
						const key = `board:${boardRef.itemInstanceId}`;
						if (seen.has(key)) {
							return yield* Effect.fail(
								GameEngineError.actionRejected(
									"input_mismatch",
									`Duplicate input ref "${key}".`,
								),
							);
						}
						const item = save.board.items[boardRef.itemInstanceId];
						if (!item) {
							return yield* Effect.fail(
								GameEngineError.actionRejected(
									"input_unavailable",
									`Missing board input "${boardRef.itemInstanceId}".`,
								),
							);
						}
						seen.add(key);
						resolved.push({
							kind: "board",
							itemId: item.itemId,
							itemInstanceId: item.id,
							quantity: 1,
						});
					}),
			)
			.with(
				{
					kind: "inventory",
				},
				(inventoryRef) =>
					Effect.gen(function* () {
						const key = `inventory:${inventoryRef.slotIndex}`;
						if (seen.has(key)) {
							return yield* Effect.fail(
								GameEngineError.actionRejected(
									"input_mismatch",
									`Duplicate input ref "${key}".`,
								),
							);
						}
						const slot = save.inventory.slots[inventoryRef.slotIndex];
						if (
							!slot ||
							readGameSaveInventorySlotQuantity(slot) < inventoryRef.quantity
						) {
							return yield* Effect.fail(
								GameEngineError.actionRejected(
									"input_unavailable",
									`Missing inventory input at slot ${inventoryRef.slotIndex}.`,
								),
							);
						}
						seen.add(key);
						resolved.push({
							kind: "inventory",
							itemId: slot.itemId,
							quantity: inventoryRef.quantity,
							slotIndex: inventoryRef.slotIndex,
						});
					}),
			)
			.exhaustive();
	}

	return resolved;
});
