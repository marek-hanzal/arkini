import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave, GameSaveBoardItem } from "~/v0/game/engine/model/GameSaveSchema";
import { doesGameGrantSelectorMatchIds } from "~/v0/game/effects/doesGameGrantSelectorMatchIds";
import { readGameWorldGrantIds } from "~/v0/game/effects/readGameWorldGrantIds";

export namespace readCraftLineEffectState {
	export interface Props {
		config: GameConfig;
		nowMs?: number;
		recipe: GameConfig["craftRecipes"][string];
		recipeId: string;
		save: GameSave;
		targetItem: GameSaveBoardItem;
	}
}

export const readCraftLineEffectState = ({
	config,
	nowMs,
	recipe,
	recipeId,
	save,
	targetItem,
}: readCraftLineEffectState.Props) => {
	const grantIds = readGameWorldGrantIds({
		config,
		nowMs,
		save,
	});
	let grantsReady = true;
	let blocked = false;
	const blockReasons: string[] = [];

	for (const lineEffect of recipe.effects ?? []) {
		if (lineEffect.kind === "grant.require") {
			const ready = doesGameGrantSelectorMatchIds({
				grantIds,
				selector: lineEffect.selector,
			});
			if (lineEffect.phase === "start" && !ready) grantsReady = false;
		}
		if (lineEffect.kind === "grant.blockStart") {
			const active = doesGameGrantSelectorMatchIds({
				grantIds,
				selector: lineEffect.selector,
			});
			if (active) {
				blocked = true;
				blockReasons.push(
					lineEffect.reason ?? lineEffect.label ?? "Craft recipe is blocked.",
				);
			}
		}
	}

	return {
		blocked,
		blockReasons,
		grantIds,
		grantsReady,
	};
};
