import { Effect } from "effect";
import { resolveSingleInputRefFx } from "~/activation/resolveSingleInputRefFx";
import type { GameActionResolvedInputRef } from "~/action/GameActionResolvedInputRef";
import type { GameActionItemStackSchema } from "~/action/GameActionItemStackSchema";
import { readBoardItemRuntimeStateStatus } from "~/board/readBoardItemRuntimeStateStatus";
import { readBoardItemStackCapacity } from "~/board/readBoardItemStackCapacity";
import type { GameConfig } from "~/config/GameConfigTypes";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameSave, GameSaveBoardItem } from "~/engine/model/GameSaveSchema";

export namespace checkItemStackReadinessFx {
	export interface Props {
		action: GameActionItemStackSchema.Type;
		config: GameConfig;
		save: GameSave;
	}

	export interface Result {
		moveQuantity: number;
		source: GameActionResolvedInputRef;
		target: GameSaveBoardItem;
	}
}

type ItemStackReadinessScope = checkItemStackReadinessFx.Props & {
	readonly source: GameActionResolvedInputRef;
	readonly target: GameSaveBoardItem;
};

const readStackTargetFx = Effect.fn("checkItemStackReadinessFx.readStackTargetFx")(function* ({
	action,
	save,
}: checkItemStackReadinessFx.Props) {
	const target = save.board.items[action.targetItemInstanceId];
	if (target) return target;

	return yield* Effect.fail(
		GameEngineError.actionRejected(
			"unsupported_target",
			`Stack target "${action.targetItemInstanceId}" must be a board tile.`,
		),
	);
});

const readStackSourceFx = Effect.fn("checkItemStackReadinessFx.readStackSourceFx")(function* ({
	action,
	save,
	target,
}: Pick<checkItemStackReadinessFx.Props, "action" | "save"> & {
	target: GameSaveBoardItem;
}) {
	const source = yield* resolveSingleInputRefFx({
		inputRef: action.sourceRef,
		missingMessage: "Missing stack source.",
		save,
	});
	if (source.kind === "board" && source.itemInstanceId === target.id) {
		return yield* Effect.fail(
			GameEngineError.actionRejected("input_mismatch", "Item cannot stack with itself."),
		);
	}
	return source;
});

const assertStackableItemsFx = Effect.fn("checkItemStackReadinessFx.assertStackableItemsFx")(
	function* ({ config, source, target }: ItemStackReadinessScope) {
		if (source.itemId !== target.itemId) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"invalid_merge",
					`Item "${source.itemId}" cannot stack with "${target.itemId}".`,
				),
			);
		}

		if ((config.items[target.itemId]?.maxStackSize ?? 1) > 1) return;

		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"invalid_merge",
				`Item "${target.itemId}" is not stackable on the board.`,
			),
		);
	},
);

const assertStackTargetReadyFx = Effect.fn("checkItemStackReadinessFx.assertStackTargetReadyFx")(
	function* ({ save, target }: ItemStackReadinessScope) {
		const stateStatus = readBoardItemRuntimeStateStatus({
			itemInstanceId: target.id,
			save,
		});
		if (!stateStatus.busy && !stateStatus.preservable) return;

		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"item_busy",
				stateStatus.busy
					? "Stack target has a running job."
					: "Stack target has stored runtime state and cannot accept stack items.",
			),
		);
	},
);

const readStackMoveQuantityFx = Effect.fn("checkItemStackReadinessFx.readStackMoveQuantityFx")(
	function* ({ config, source, target }: ItemStackReadinessScope) {
		const capacity = readBoardItemStackCapacity({
			config,
			item: target,
		});
		const moveQuantity = Math.min(source.quantity, capacity);
		if (moveQuantity > 0) return moveQuantity;

		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"board:full",
				`Board stack "${target.id}" is already full.`,
			),
		);
	},
);

export const checkItemStackReadinessFx = Effect.fn("checkItemStackReadinessFx")(function* (
	props: checkItemStackReadinessFx.Props,
) {
	const target = yield* readStackTargetFx(props);
	const source = yield* readStackSourceFx({
		...props,
		target,
	});
	const scope = {
		...props,
		source,
		target,
	} satisfies ItemStackReadinessScope;

	yield* assertStackableItemsFx(scope);
	yield* assertStackTargetReadyFx(scope);

	return {
		moveQuantity: yield* readStackMoveQuantityFx(scope),
		source,
		target,
	} satisfies checkItemStackReadinessFx.Result;
});
