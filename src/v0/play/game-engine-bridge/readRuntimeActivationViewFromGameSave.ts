import type { ActivationView } from "~/v0/board/view/ActivationViewSchema";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave, GameSaveBoardItem } from "~/v0/game/engine/model/GameSaveSchema";
import { readRuntimeProducerActivationViewFromGameSave } from "~/v0/play/game-engine-bridge/readRuntimeProducerActivationViewFromGameSave";
import { readRuntimeStashActivationViewFromGameSave } from "~/v0/play/game-engine-bridge/readRuntimeStashActivationViewFromGameSave";

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
		save,
	}) ??
	readRuntimeProducerActivationViewFromGameSave({
		boardItem,
		config,
		nowMs,
		save,
	});
