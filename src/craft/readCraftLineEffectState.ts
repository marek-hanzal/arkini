import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameCraftRecipeDefinition } from "~/config/GameItemCapabilities";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { doesGameGrantSelectorMatchIds } from "~/effects/doesGameGrantSelectorMatchIds";
import { readGameWorldGrantIds } from "~/effects/readGameWorldGrantIds";

export namespace readCraftLineEffectState {
	export interface Props {
		config: GameConfig;
		nowMs?: number;
		recipe: GameCraftRecipeDefinition;
		save: GameSave;
	}
}

export const readCraftLineEffectState = ({
	config,
	nowMs,
	recipe,
	save,
}: readCraftLineEffectState.Props) => {
	const grantIds = readGameWorldGrantIds({
		config,
		nowMs,
		save,
	});
	let startRequirementsReady = true;
	let blocked = false;
	const blockReasons: string[] = [];

	for (const lineEffect of recipe.effects ?? []) {
		if (lineEffect.kind === "grant.require") {
			const ready = doesGameGrantSelectorMatchIds({
				grantIds,
				selector: lineEffect.selector,
			});
			if (lineEffect.phase === "start" && !ready) startRequirementsReady = false;
			continue;
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
		startRequirementsReady,
		startGateReady: startRequirementsReady && !blocked,
	};
};
