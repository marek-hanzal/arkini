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

type CraftEffectRequirement = {
	display: "always" | "whenActive" | "whenMissing" | "never";
	kind: "grant.blockStart" | "grant.require";
	label: string;
	ready: boolean;
};

const isCraftEffectRequirementActive = (requirement: CraftEffectRequirement) =>
	requirement.kind === "grant.blockStart" ? !requirement.ready : requirement.ready;

const shouldDisplayCraftEffectRequirement = (requirement: CraftEffectRequirement) => {
	if (requirement.display === "never") return false;
	if (requirement.display === "always") return true;
	if (requirement.display === "whenMissing") return !requirement.ready;
	return isCraftEffectRequirementActive(requirement);
};

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
	const requirements: CraftEffectRequirement[] = [];

	for (const lineEffect of recipe.effects ?? []) {
		if (lineEffect.kind === "grant.require") {
			const ready = doesGameGrantSelectorMatchIds({
				grantIds,
				selector: lineEffect.selector,
			});
			if (lineEffect.phase === "start" && !ready) startRequirementsReady = false;
			const requirement = {
				display: lineEffect.display,
				kind: lineEffect.kind,
				label: lineEffect.label ?? lineEffect.reason ?? "Required grant",
				ready,
			};
			if (shouldDisplayCraftEffectRequirement(requirement)) {
				requirements.push(requirement);
			}
			continue;
		}

		if (lineEffect.kind === "grant.blockStart") {
			const active = doesGameGrantSelectorMatchIds({
				grantIds,
				selector: lineEffect.selector,
			});
			const requirement = {
				display: lineEffect.display,
				kind: lineEffect.kind,
				label: lineEffect.reason ?? lineEffect.label ?? "Craft recipe is blocked.",
				ready: !active,
			};
			if (shouldDisplayCraftEffectRequirement(requirement)) {
				requirements.push(requirement);
			}
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
		requirements,
		startRequirementsReady,
		startGateReady: startRequirementsReady && !blocked,
	};
};
