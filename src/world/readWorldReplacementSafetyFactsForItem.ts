import type { GameSave } from "~/engine/model/GameSaveSchema";
import type {
	WorldReplacementBlockReason,
	WorldReplacementSafetyFacts,
} from "~/world/WorldReplacementSafetyFacts";

export namespace readWorldReplacementSafetyFactsForItem {
	export interface Props {
		itemInstanceId: string;
		save: GameSave;
	}
}

const pushReason = (
	reasons: WorldReplacementBlockReason[],
	reason: WorldReplacementBlockReason,
) => {
	if (!reasons.includes(reason)) reasons.push(reason);
};

export const readWorldReplacementSafetyFactsForItem = ({
	itemInstanceId,
	save,
}: readWorldReplacementSafetyFactsForItem.Props): WorldReplacementSafetyFacts => {
	const blockReasons: WorldReplacementBlockReason[] = [];

	if (save.craftInputs[itemInstanceId]) pushReason(blockReasons, "craft_input_state");
	if (Object.values(save.craftJobs).some((job) => job.targetItemInstanceId === itemInstanceId)) {
		pushReason(blockReasons, "craft_job");
	}
	if (Object.values(save.producerJobs).some((job) => job.itemInstanceId === itemInstanceId)) {
		pushReason(blockReasons, "producer_job");
	}
	if (
		save.producerInputs[itemInstanceId] ||
		save.lines[itemInstanceId] ||
		save.producerCharges[itemInstanceId]
	) {
		pushReason(blockReasons, "producer_runtime_state");
	}
	return {
		blockReasons,
		itemInstanceId,
		status: blockReasons.length > 0 ? "blocked" : "safe",
	};
};
