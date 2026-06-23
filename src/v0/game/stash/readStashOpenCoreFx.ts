import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { checkGameRequirementsFx } from "~/v0/game/requirements/checkGameRequirementsFx";
import { readStoredRequirementQuantitiesFx } from "~/v0/game/requirements/readStoredRequirementQuantitiesFx";
import { readStashRemainingChargesFx } from "~/v0/game/stash/readStashRemainingChargesFx";
import { readStashRuntimeTargetFx } from "~/v0/game/stash/readStashRuntimeTargetFx";

export namespace readStashOpenCoreFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		stashItemInstanceId: string;
	}
}

export const readStashOpenCoreFx = Effect.fn("readStashOpenCoreFx")(function* ({
	config,
	save,
	stashItemInstanceId,
}: readStashOpenCoreFx.Props) {
	const target = yield* readStashRuntimeTargetFx({
		config,
		save,
		stashItemInstanceId,
	});
	const remainingCharges = yield* readStashRemainingChargesFx({
		config,
		save,
		stashId: target.stashId,
		stashItemInstanceId,
	});
	if (remainingCharges <= 0) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"stash_depleted",
				`Stash "${stashItemInstanceId}" has no charges left.`,
			),
		);
	}

	const storedItems = yield* readStoredRequirementQuantitiesFx({
		save,
		targetItemInstanceId: stashItemInstanceId,
	});
	yield* checkGameRequirementsFx({
		requirements: target.stash.requirements,
		save,
		storedItems,
		targetItemInstanceId: stashItemInstanceId,
	});

	return {
		...target,
		remainingCharges,
	};
});
