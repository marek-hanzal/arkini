import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace readProducerDeliveryBlocked {
	export interface Props {
		itemInstanceId: string;
		save: GameSave;
	}
}

export const readProducerDeliveryBlocked = ({
	itemInstanceId,
	save,
}: readProducerDeliveryBlocked.Props) =>
	Object.values(save.producerJobs).some(
		(job) =>
			job.itemInstanceId === itemInstanceId && job.delivery?.lastBlockedAtMs !== undefined,
	);
