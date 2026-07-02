import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { readProducerJobProductLine } from "~/v0/game/producer/readProducerJobProductLine";
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
				(readProducerJobProductLine({
					config,
					job,
					save,
				})?.chargeCost ?? 0),
			0,
		);
