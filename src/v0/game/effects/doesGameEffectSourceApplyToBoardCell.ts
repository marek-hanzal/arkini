import type { BoardCell } from "~/v0/game/board/BoardCell";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readChebyshevDistance } from "~/v0/game/effects/readChebyshevDistance";
import { readGameEffectSourceCell } from "~/v0/game/effects/readGameEffectSourceCell";
import type { GameEffectSourceInstance } from "~/v0/game/effects/GameEffectSourceInstance";

export namespace doesGameEffectSourceApplyToBoardCell {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		source: GameEffectSourceInstance;
		targetCell?: BoardCell;
	}
}

export const doesGameEffectSourceApplyToBoardCell = ({
	config,
	save,
	source,
	targetCell,
}: doesGameEffectSourceApplyToBoardCell.Props) => {
	const effect = config.effects[source.effectId];
	if (!effect) return false;
	if (effect.scope === "global") return true;
	if (!targetCell) return false;

	const sourceCell = readGameEffectSourceCell({
		save,
		sourceItemInstanceId: source.sourceItemInstanceId,
	});
	if (!sourceCell) return false;

	return readChebyshevDistance(sourceCell, targetCell) <= effect.radius;
};
