import type { ActivationView } from "~/board/view/ActivationViewSchema";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave, GameSaveBoardItem } from "~/engine/model/GameSaveSchema";
import { readRuntimeProducerActivationViewFromGameSave } from "~/play/game-engine-bridge/readRuntimeProducerActivationViewFromGameSave";
import { readRuntimeStashActivationViewFromGameSave } from "~/play/game-engine-bridge/readRuntimeStashActivationViewFromGameSave";

export namespace readRuntimeActivationViewFromGameSave {
	export interface Props {
		boardItem: GameSaveBoardItem;
		config: GameConfig;
		nowMs: number;
		save: GameSave;
	}
}

export const readRuntimeActivationViewFromGameSave = ({
	boardItem,
	config,
	nowMs,
	save,
}: readRuntimeActivationViewFromGameSave.Props): ActivationView | undefined =>
	readRuntimeStashActivationViewFromGameSave({
		boardItem,
		config,
		nowMs,
		save,
	}) ??
	readRuntimeProducerActivationViewFromGameSave({
		boardItem,
		config,
		nowMs,
		save,
	});
