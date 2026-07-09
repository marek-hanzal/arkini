import type { BoardCell } from "~/board/BoardCellPosition";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameCraftRecipeDefinition } from "~/config/GameItemCapabilities";
import { readEffectiveLootPlan, readEffectiveOutputEntries } from "~/effects/readEffectiveOutputEntries";
import { readGameEffectSourceCell } from "~/effects/readGameEffectSourceCell";
import { readGameWorldGrantIds } from "~/effects/readGameWorldGrantIds";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace readCraftEffectiveLootPlan {
	export interface Props {
		config: GameConfig;
		grantIds?: ReadonlySet<string>;
		itemInstanceId: string;
		lineId: string;
		nowMs?: number;
		recipe: GameCraftRecipeDefinition;
		save: GameSave;
		targetCell?: BoardCell;
	}
}

export const readCraftEffectiveLootPlan = ({
	config,
	grantIds: providedGrantIds,
	itemInstanceId,
	lineId,
	nowMs,
	recipe,
	save,
	targetCell,
}: readCraftEffectiveLootPlan.Props) => {
	const grantIds =
		providedGrantIds ??
		readGameWorldGrantIds({
			config,
			nowMs,
			save,
		});

	return readEffectiveLootPlan(
		readEffectiveOutputEntries({
			config,
			grantIds,
			itemInstanceId,
			lineId,
			lineVisible: true,
			output: recipe.output,
			save,
			targetCell:
				targetCell ??
				readGameEffectSourceCell({
					save,
					sourceItemInstanceId: itemInstanceId,
				}),
		}),
	);
};
