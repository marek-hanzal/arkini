import { Effect } from "effect";
import { match } from "ts-pattern";
import { checkActivationInputsFx } from "~/v0/game/engine/fx/checkActivationInputsFx";
import { checkGameRequirementsFx } from "~/v0/game/engine/fx/checkGameRequirementsFx";
import { readStashBoardItemFx } from "~/v0/game/stash/readStashBoardItemFx";
import { readStashRemainingChargesFx } from "~/v0/game/stash/readStashRemainingChargesFx";
import { readStoredRequirementQuantitiesFx } from "~/v0/game/engine/fx/readStoredRequirementQuantitiesFx";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameActionStashOpen } from "~/v0/game/engine/model/GameActionStashOpen";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace checkStashOpenReadinessFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: GameActionStashOpen;
	}
}

export const checkStashOpenReadinessFx = Effect.fn("checkStashOpenReadinessFx")(function* ({
	config,
	save,
	action,
}: checkStashOpenReadinessFx.Props) {
	const stashItem = yield* readStashBoardItemFx({
		config,
		save,
		stashItemInstanceId: action.stashItemInstanceId,
	});
	const stashId = config.items[stashItem.itemId]?.stashId;
	const stash = stashId ? config.stashes[stashId] : undefined;
	if (!stashId || !stash) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(
				`Stash item "${stashItem.itemId}" references missing stash.`,
			),
		);
	}
	if (!config.lootTables[stash.outputTableId]) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(`Missing loot table "${stash.outputTableId}".`),
		);
	}

	const remainingCharges = yield* readStashRemainingChargesFx({
		config,
		save,
		stashId,
		stashItemInstanceId: action.stashItemInstanceId,
	});
	if (remainingCharges <= 0) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"stash_depleted",
				`Stash "${action.stashItemInstanceId}" has no charges left.`,
			),
		);
	}

	const storedItems = yield* readStoredRequirementQuantitiesFx({
		save,
		targetItemInstanceId: action.stashItemInstanceId,
	});
	yield* checkGameRequirementsFx({
		config,
		requirements: stash.requirements,
		save,
		storedItems,
	});
	yield* match(stash.placement)
		.with("board_then_inventory", () => Effect.void)
		.exhaustive();
	yield* checkActivationInputsFx({
		inputRefs: action.inputRefs,
		inputs: stash.inputs,
		save,
	});

	return {
		remainingCharges,
		stash,
		stashId,
		stashItem,
	};
});
