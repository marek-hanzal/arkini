import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export const findActiveEffectByProducerJobId = ({
	producerJobId,
	save,
}: {
	producerJobId: string;
	save: GameSave;
}) =>
	Object.values(save.activeEffects ?? {}).find(
		(effect) => effect.producerJobId === producerJobId,
	);
