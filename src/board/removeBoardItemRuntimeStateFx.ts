import { Effect } from "effect";
import { removeCraftInputStateFromSaveFx } from "~/craft/removeCraftInputStateFromSaveFx";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { removeActiveEffectFromSaveFx } from "~/effects/removeActiveEffectFromSaveFx";
import { removeProducerInputStateFromSaveFx } from "~/producer/removeProducerInputStateFromSaveFx";

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
	delete save.producerCharges[itemInstanceId];
	delete save.itemCapacities[itemInstanceId];
	delete save.lines[itemInstanceId];
	yield* removeProducerInputStateFromSaveFx({
		itemInstanceId,
		save,
	});
	yield* removeCraftInputStateFromSaveFx({
		save,
		targetItemInstanceId: itemInstanceId,
	});

	for (const [jobId, job] of Object.entries(save.producerJobs)) {
		if (job.itemInstanceId === itemInstanceId) delete save.producerJobs[jobId];
	}

	for (const [jobId, job] of Object.entries(save.craftJobs)) {
		if (job.targetItemInstanceId === itemInstanceId) delete save.craftJobs[jobId];
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
