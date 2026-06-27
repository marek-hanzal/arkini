import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import type {
	WorldReplacementBlockReason,
	WorldReplacementSafetyFacts,
} from "~/v0/game/world/WorldReplacementSafetyFacts";

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
	if (
		Object.values(save.producerJobs).some(
			(job) => job.producerItemInstanceId === itemInstanceId,
		)
	) {
		pushReason(blockReasons, "producer_job");
	}
	if (
		save.producerInputs[itemInstanceId] ||
		save.producerLines[itemInstanceId] ||
		save.producerCharges[itemInstanceId]
	) {
		pushReason(blockReasons, "producer_runtime_state");
	}
	if (save.storedRequirements[itemInstanceId]) {
		pushReason(blockReasons, "stored_requirement_state");
	}

	return {
		blockReasons,
		itemInstanceId,
		status: blockReasons.length > 0 ? "blocked" : "safe",
	};
};
