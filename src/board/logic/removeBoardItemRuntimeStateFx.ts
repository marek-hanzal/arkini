import { Effect } from "effect";
import type { GameSave } from "~/engine/model/GameSaveSchema";

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
	delete save.producerInputs[itemInstanceId];
	delete save.craftInputs[itemInstanceId];

	for (const [jobId, job] of Object.entries(save.producerJobs)) {
		if (job.itemInstanceId === itemInstanceId) delete save.producerJobs[jobId];
	}

	for (const [jobId, job] of Object.entries(save.craftJobs)) {
		if (job.targetItemInstanceId === itemInstanceId) delete save.craftJobs[jobId];
	}

	for (const [effectInstanceId, activeEffect] of Object.entries(save.activeEffects)) {
		if (activeEffect.sourceItemInstanceId === itemInstanceId) {
			delete save.activeEffects[effectInstanceId];
		}
	}
});
