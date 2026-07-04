import { Effect } from "effect";
import { removeItemCapacityStateFromSaveFx } from "~/capacity/removeItemCapacityStateFromSaveFx";
import { removeCraftJobFromSaveFx } from "~/craft/removeCraftJobFromSaveFx";
import { removeCraftInputStateFromSaveFx } from "~/craft/removeCraftInputStateFromSaveFx";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { removeActiveEffectFromSaveFx } from "~/effects/removeActiveEffectFromSaveFx";
import { removeProducerChargeStateFromSaveFx } from "~/producer/removeProducerChargeStateFromSaveFx";
import { removeProducerInputStateFromSaveFx } from "~/producer/removeProducerInputStateFromSaveFx";
import { removeProducerJobFromSaveFx } from "~/producer/removeProducerJobFromSaveFx";
import { removeProducerLineStateFromSaveFx } from "~/producer/removeProducerLineStateFromSaveFx";

export namespace removeBoardItemRuntimeStateFx {
	export interface Props {
		itemInstanceId: string;
		save: GameSave;
	}
}

export const removeBoardItemRuntimeStateFx = Effect.fn("removeBoardItemRuntimeStateFx")(function* ({
	itemInstanceId,
	save,
}: removeBoardItemRuntimeStateFx.Props) {
	yield* removeProducerChargeStateFromSaveFx({
		itemInstanceId,
		save,
	});
	yield* removeItemCapacityStateFromSaveFx({
		itemInstanceId,
		save,
	});
	yield* removeProducerLineStateFromSaveFx({
		itemInstanceId,
		save,
	});
	yield* removeProducerInputStateFromSaveFx({
		itemInstanceId,
		save,
	});
	yield* removeCraftInputStateFromSaveFx({
		save,
		targetItemInstanceId: itemInstanceId,
	});

	for (const [jobId, job] of Object.entries(save.producerJobs)) {
		if (job.itemInstanceId === itemInstanceId) {
			yield* removeProducerJobFromSaveFx({
				jobId,
				save,
			});
		}
	}

	for (const [jobId, job] of Object.entries(save.craftJobs)) {
		if (job.targetItemInstanceId === itemInstanceId) {
			yield* removeCraftJobFromSaveFx({
				jobId,
				save,
			});
		}
	}

	for (const [effectInstanceId, activeEffect] of Object.entries(save.activeEffects)) {
		if (activeEffect.sourceItemInstanceId === itemInstanceId) {
			yield* removeActiveEffectFromSaveFx({
				activeEffectId: effectInstanceId,
				save,
			});
		}
	}
});
