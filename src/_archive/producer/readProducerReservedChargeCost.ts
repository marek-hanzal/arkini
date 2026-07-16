import type { GameConfig } from "~/config/GameConfigTypes";
import { readProducerJobLine } from "~/producer/readProducerJobLine";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export const readProducerReservedChargeCost = ({
	config,
	itemInstanceId,
	save,
}: {
	config: GameConfig;
	itemInstanceId: string;
	save: GameSave;
}) =>
	Object.values(save.producerJobs)
		.filter((job) => job.itemInstanceId === itemInstanceId)
		.reduce(
			(sum, job) =>
				sum +
				(readProducerJobLine({
					config,
					job,
					save,
				})?.chargeCost ?? 0),
			0,
		);
