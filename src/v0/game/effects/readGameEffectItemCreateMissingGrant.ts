import type { BoardCell } from "~/v0/game/board/BoardCell";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { doesGameGrantSelectorMatchIds } from "~/v0/game/effects/doesGameGrantSelectorMatchIds";
import { readGameEffectTargetGrantIds } from "~/v0/game/effects/readGameEffectTargetGrantIds";

export namespace readGameEffectItemCreateMissingGrant {
	export interface Props {
		config: GameConfig;
		ignoredSourceIds?: ReadonlySet<string>;
		itemId: string;
		nowMs?: number;
		save: GameSave;
		targetCell?: BoardCell;
	}
}

export const readGameEffectItemCreateMissingGrant = ({
	config,
	ignoredSourceIds,
	itemId,
	nowMs,
	save,
	targetCell,
}: readGameEffectItemCreateMissingGrant.Props) => {
	const selector = config.items[itemId]?.grantSelector;
	if (!selector) return false;

	const grantIds = readGameEffectTargetGrantIds({
		config,
		ignoredSourceIds,
		nowMs,
		save,
		target: {
			kind: "item",
			itemId,
			targetCell,
		},
	});

	return !doesGameGrantSelectorMatchIds({
		grantIds,
		selector,
	});
};
