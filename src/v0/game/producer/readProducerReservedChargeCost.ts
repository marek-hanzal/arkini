import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { readProducerJobLine } from "~/v0/game/producer/readProducerJobLine";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export const readProducerReservedChargeCost = ({
	config,
	producerItemInstanceId,
	save,
}: {
	config: GameConfig;
	producerItemInstanceId: string;
	save: GameSave;
}) =>
	Object.values(save.producerJobs)
		.filter((job) => job.producerItemInstanceId === producerItemInstanceId)
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
