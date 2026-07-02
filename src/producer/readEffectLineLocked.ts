import type { GameConfig } from "~/config/GameConfigSchema";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { readWorldActiveEffectFacts } from "~/world/readWorldActiveEffectFacts";
import { readLineDefinitionFromConfig } from "~/config/readLineDefinition";

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
			})?.effect?.id
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
