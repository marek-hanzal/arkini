import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readWorldActiveEffectFacts } from "~/v0/game/world/readWorldActiveEffectFacts";
import { readProducerLineDefinitionFromConfig } from "~/v0/game/config/readProducerLineDefinition";

export namespace readProducerEffectLineLocked {
	export interface Props {
		config: GameConfig;
		nowMs?: number;
		producerItemInstanceId: string;
		lineId: string;
		save: GameSave;
	}
}

export const readProducerEffectLineLocked = ({
	config,
	nowMs,
	producerItemInstanceId,
	lineId,
	save,
}: readProducerEffectLineLocked.Props) => {
	const producerItem = save.board.items[producerItemInstanceId];
	const effectId = producerItem
		? readProducerLineDefinitionFromConfig({
				config,
				producerId: producerItem.itemId,
				lineId,
			})?.activatesEffectId
		: undefined;
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
