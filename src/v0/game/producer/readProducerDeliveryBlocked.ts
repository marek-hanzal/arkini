import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace readProducerDeliveryBlocked {
	export interface Props {
		producerItemInstanceId: string;
		save: GameSave;
	}
}

export const readProducerDeliveryBlocked = ({
	producerItemInstanceId,
	save,
}: readProducerDeliveryBlocked.Props) =>
	Object.values(save.producerJobs).some(
		(job) =>
			job.producerItemInstanceId === producerItemInstanceId &&
			job.delivery?.lastBlockedAtMs !== undefined,
	);
