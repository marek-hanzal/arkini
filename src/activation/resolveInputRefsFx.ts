import { Context, Effect } from "effect";
import { match } from "ts-pattern";
import type { GameActionItemRefSchema } from "~/action/GameActionItemRefSchema";
import type { GameActionResolvedInputRef } from "~/action/GameActionResolvedInputRef";
import { readBoardItemRuntimeStateStatus } from "~/board/readBoardItemRuntimeStateStatus";
import { GameEngineError } from "~/engine/model/GameEngineError";
import { readGameSaveInventorySlotQuantity } from "~/inventory/model/GameSaveInventorySlot";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace resolveInputRefsFx {
	export interface Props {
		save: GameSave;
		inputRefs: readonly GameActionItemRefSchema.Type[];
	}
}

class ResolveInputRefsScopeFx extends Context.Tag("ResolveInputRefsScopeFx")<
	ResolveInputRefsScopeFx,
	{
		readonly save: GameSave;
		readonly seen: Set<string>;
	}
>() {
	//
}

const assertUniqueInputRefFx = Effect.fn("resolveInputRefsFx.assertUniqueInputRefFx")(function* ({
	key,
}: {
	key: string;
}) {
	const { seen } = yield* ResolveInputRefsScopeFx;
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
}: Extract<
	GameActionItemRefSchema.Type,
	{
		kind: "board";
	}
>) {
	const { save } = yield* ResolveInputRefsScopeFx;
	const key = `board:${itemInstanceId}`;
	yield* assertUniqueInputRefFx({
		key,
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

	const stateStatus = readBoardItemRuntimeStateStatus({
		itemInstanceId,
		save,
	});
	if (stateStatus.busy || stateStatus.preservable) {
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
		quantity: 1,
	} satisfies GameActionResolvedInputRef;
});

const resolveInventoryInputRefFx = Effect.fn("resolveInputRefsFx.resolveInventoryInputRefFx")(
	function* ({
		quantity,
		slotIndex,
	}: Extract<
		GameActionItemRefSchema.Type,
		{
			kind: "inventory";
		}
	>) {
		const { save } = yield* ResolveInputRefsScopeFx;
		const key = `inventory:${slotIndex}`;
		yield* assertUniqueInputRefFx({
			key,
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
}: {
	ref: GameActionItemRefSchema.Type;
}) {
	return yield* match(ref)
		.with(
			{
				kind: "board",
			},
			resolveBoardInputRefFx,
		)
		.with(
			{
				kind: "inventory",
			},
			resolveInventoryInputRefFx,
		)
		.exhaustive();
});

const resolveInputRefsProgramFx = Effect.fn("resolveInputRefsFx.resolveInputRefsProgramFx")(
	function* ({ inputRefs }: { inputRefs: readonly GameActionItemRefSchema.Type[] }) {
		const resolved: GameActionResolvedInputRef[] = [];
		for (const ref of inputRefs) {
			resolved.push(
				yield* resolveInputRefFx({
					ref,
				}),
			);
		}
		return resolved;
	},
);

export const resolveInputRefsFx = Effect.fn("resolveInputRefsFx")(function* ({
	inputRefs,
	save,
}: resolveInputRefsFx.Props) {
	return yield* resolveInputRefsProgramFx({
		inputRefs,
	}).pipe(
		Effect.provideService(ResolveInputRefsScopeFx, {
			save,
			seen: new Set<string>(),
		}),
	);
});
