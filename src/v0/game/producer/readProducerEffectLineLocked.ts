import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readWorldActiveEffectFacts } from "~/v0/game/world/readWorldActiveEffectFacts";

export namespace readProducerEffectLineLocked {
	export interface Props {
		config: GameConfig;
		nowMs?: number;
		producerItemInstanceId: string;
		productId: string;
		save: GameSave;
	}
}

export const readProducerEffectLineLocked = ({
	config,
	nowMs,
	producerItemInstanceId,
	productId,
	save,
}: readProducerEffectLineLocked.Props) => {
	const effectId = config.products[productId]?.activatesEffectId;
	if (!effectId) return false;

	return readWorldActiveEffectFacts({
		config,
		nowMs,
		save,
	}).some(
		(facts) =>
			facts.effect.sourceItemInstanceId === producerItemInstanceId &&
			facts.effect.effectId === effectId &&
			facts.status !== "expired",
	);
};
