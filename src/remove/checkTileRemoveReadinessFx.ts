import { Context, Effect } from "effect";
import { assertResolvedInputRefIsNotBoardItemFx } from "~/activation/assertResolvedInputRefIsNotBoardItemFx";
import { assertResolvedInputRefQuantityFx } from "~/activation/assertResolvedInputRefQuantityFx";
import { resolveSingleInputRefFx } from "~/activation/resolveSingleInputRefFx";
import type { GameActionResolvedInputRef } from "~/action/GameActionResolvedInputRef";
import type { GameActionTileRemoveSchema } from "~/action/GameActionTileRemoveSchema";
import { readBoardItemRuntimeStateStatus } from "~/board/readBoardItemRuntimeStateStatus";
import type { GameConfig } from "~/config/GameConfigTypes";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace checkTileRemoveReadinessFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: GameActionTileRemoveSchema.Type;
	}
}

type TileRemoveTarget = NonNullable<GameSave["board"]["items"][string]>;

class TileRemoveReadinessScopeFx extends Context.Tag("TileRemoveReadinessScopeFx")<
	TileRemoveReadinessScopeFx,
	checkTileRemoveReadinessFx.Props & {
		readonly target: TileRemoveTarget;
		readonly tool: GameActionResolvedInputRef;
	}
>() {
	//
}

const readTileRemoveTargetFx = Effect.fn("checkTileRemoveReadinessFx.readTileRemoveTargetFx")(
	function* ({ action, save }: checkTileRemoveReadinessFx.Props) {
		const target = save.board.items[action.targetItemInstanceId];
		if (target) return target;

		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"invalid_actor",
				`Missing removable board tile "${action.targetItemInstanceId}".`,
			),
		);
	},
);

const readTileRemoveToolFx = Effect.fn("checkTileRemoveReadinessFx.readTileRemoveToolFx")(
	function* ({
		action,
		save,
		target,
	}: Pick<checkTileRemoveReadinessFx.Props, "action" | "save"> & {
		target: TileRemoveTarget;
	}) {
		const tool = yield* resolveSingleInputRefFx({
			inputRef: action.toolRef,
			missingMessage: "Missing removal tool.",
			save,
		});
		yield* assertResolvedInputRefIsNotBoardItemFx({
			inputRef: tool,
			message: "Tile cannot remove itself.",
			targetItemInstanceId: target.id,
		});
		yield* assertResolvedInputRefQuantityFx({
			expectedQuantity: 1,
			inputRef: tool,
			message: "Tile removal tool quantity must be 1.",
		});
		return tool;
	},
);

const assertTileRemoveTargetNotBusyFx = Effect.fn(
	"checkTileRemoveReadinessFx.assertTileRemoveTargetNotBusyFx",
)(function* () {
	const { save, target } = yield* TileRemoveReadinessScopeFx;
	const stateStatus = readBoardItemRuntimeStateStatus({
		itemInstanceId: target.id,
		save,
	});
	if (!stateStatus.producerBusy && !stateStatus.craftBusy) return;

	return yield* Effect.fail(
		GameEngineError.actionRejected(
			"invalid_actor",
			stateStatus.producerBusy
				? "Tile has a running producer job and cannot be removed."
				: "Tile has a running craft job and cannot be removed.",
		),
	);
});

const readTileRemovalRuleFx = Effect.fn("checkTileRemoveReadinessFx.readTileRemovalRuleFx")(
	function* () {
		const { config, target, tool } = yield* TileRemoveReadinessScopeFx;
		const targetDefinition = config.items[target.itemId];
		const removal = targetDefinition?.removeBy?.find((entry) => entry.itemId === tool.itemId);
		if (targetDefinition && removal) return removal;

		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"invalid_actor",
				`Item "${target.itemId}" cannot be removed by "${tool.itemId}".`,
			),
		);
	},
);

const checkTileRemoveReadinessProgramFx = Effect.fn(
	"checkTileRemoveReadinessFx.checkTileRemoveReadinessProgramFx",
)(function* () {
	const { target, tool } = yield* TileRemoveReadinessScopeFx;
	yield* assertTileRemoveTargetNotBusyFx();
	const removal = yield* readTileRemovalRuleFx();

	return {
		removal,
		target,
		tool,
	};
});

export const checkTileRemoveReadinessFx = Effect.fn("checkTileRemoveReadinessFx")(function* (
	props: checkTileRemoveReadinessFx.Props,
) {
	const target = yield* readTileRemoveTargetFx(props);
	const tool = yield* readTileRemoveToolFx({
		...props,
		target,
	});

	return yield* checkTileRemoveReadinessProgramFx().pipe(
		Effect.provideService(TileRemoveReadinessScopeFx, {
			...props,
			target,
			tool,
		}),
	);
});
