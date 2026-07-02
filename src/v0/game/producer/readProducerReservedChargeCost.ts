import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { readProducerJobLine } from "~/v0/game/producer/readProducerJobLine";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

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
