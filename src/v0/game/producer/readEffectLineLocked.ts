import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readWorldActiveEffectFacts } from "~/v0/game/world/readWorldActiveEffectFacts";
import { readLineDefinitionFromConfig } from "~/v0/game/config/readLineDefinition";

export namespace readEffectLineLocked {
	export interface Props {
		config: GameConfig;
		nowMs?: number;
		itemInstanceId: string;
		lineId: string;
		save: GameSave;
	}
}

export const readEffectLineLocked = ({
	config,
	nowMs,
	itemInstanceId,
	lineId,
	save,
}: readEffectLineLocked.Props) => {
	const producerItem = save.board.items[itemInstanceId];
	const effectId = producerItem
		? readLineDefinitionFromConfig({
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
			facts.effect.sourceItemInstanceId === itemInstanceId &&
			facts.effect.effectId === effectId &&
			facts.status !== "expired",
	);
};
