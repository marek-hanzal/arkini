import type { z } from "zod";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameCraftRecipeDefinition } from "~/config/GameItemCapabilities";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { ResolvedDomainSelectorSchema } from "~/config/schema/GameDomainSelectorSchema";
import { doesGameGrantSelectorMatchIds } from "~/effects/doesGameGrantSelectorMatchIds";
import { readGameWorldGrantIds } from "~/effects/readGameWorldGrantIds";

export namespace readCraftLineEffectState {
	export interface Props {
		config: GameConfig;
		grantIds?: ReadonlySet<string>;
		nowMs?: number;
		recipe: GameCraftRecipeDefinition;
		save: GameSave;
	}
}

export namespace readCraftLineStartGateState {
	export interface Props extends readCraftLineEffectState.Props {}
}

type ResolvedDomainSelector = z.infer<typeof ResolvedDomainSelectorSchema>;
type CraftRecipeEffect = NonNullable<NonNullable<GameCraftRecipeDefinition["effects"]>[number]>;
type CraftLineEffect = Extract<
	CraftRecipeEffect,
	{
		kind: "grant.require" | "grant.blockStart";
	}
>;

type CraftEffectRequirement = {
	display: "always" | "whenActive" | "whenMissing" | "never";
	itemId?: string;
	kind: "grant.blockStart" | "grant.require";
	label: string;
	ready: boolean;
};

type GrantRequirementLabel = {
	itemId?: string;
	label: string;
};

type CraftLineStartGateState = {
	blocked: boolean;
	blockReasons: string[];
	grantIds: ReadonlySet<string>;
	startGateReady: boolean;
	startRequirementsReady: boolean;
};

type EvaluatedCraftLineEffect = {
	lineEffect: CraftLineEffect;
	selectorMatched: boolean;
};

type CraftLineEffectAnalysis = CraftLineStartGateState & {
	effects: EvaluatedCraftLineEffect[];
};

const readCraftGrantIds = ({
	config,
	grantIds,
	nowMs,
	save,
}: Pick<readCraftLineEffectState.Props, "config" | "grantIds" | "nowMs" | "save">) =>
	grantIds ??
	readGameWorldGrantIds({
		config,
		nowMs,
		save,
	});

const isCraftEffectRequirementActive = (requirement: CraftEffectRequirement) =>
	requirement.kind === "grant.blockStart" ? !requirement.ready : requirement.ready;

const shouldDisplayCraftEffectRequirement = (requirement: CraftEffectRequirement) => {
	if (requirement.display === "never") return false;
	if (requirement.display === "always") return true;
	if (requirement.display === "whenMissing") return !requirement.ready;
	return isCraftEffectRequirementActive(requirement);
};

const readOwnedGrantItemId = (grantId: string) => grantId.match(/^grant:owned:(.+)$/)?.[1];

const readGrantNameById = (config: GameConfig): ReadonlyMap<string, string> => {
	const names = new Map<string, string>();

	for (const item of Object.values(config.items)) {
		for (const effect of item.effects ?? []) {
			for (const grant of effect.grants ?? []) names.set(grant.id, grant.name);
		}

		for (const line of item.producer?.lines ?? []) {
			for (const grant of line.effect?.grants ?? []) names.set(grant.id, grant.name);
		}

		for (const grant of item.stash?.line.effect?.grants ?? []) {
			names.set(grant.id, grant.name);
		}
	}

	return names;
};

const readGrantRequirementLabel = ({
	config,
	grantId,
	grantNameById,
}: {
	config: GameConfig;
	grantId: string;
	grantNameById: ReadonlyMap<string, string>;
}): GrantRequirementLabel => {
	const itemId = readOwnedGrantItemId(grantId);
	const itemName = itemId ? config.items[itemId]?.name : undefined;

	return {
		itemId: itemName ? itemId : undefined,
		label: itemName ?? grantNameById.get(grantId) ?? grantId,
	};
};

const readGrantClauseLabel = ({
	config,
	grantIds,
	grantNameById,
}: {
	config: GameConfig;
	grantIds: readonly string[];
	grantNameById: ReadonlyMap<string, string>;
}): GrantRequirementLabel => {
	const labels = grantIds.map((grantId) =>
		readGrantRequirementLabel({
			config,
			grantId,
			grantNameById,
		}),
	);
	const [singleLabel] = labels;

	if (labels.length === 1 && singleLabel) return singleLabel;

	return {
		label: `One of ${labels.map((entry) => entry.label).join(" / ")}`,
	};
};

const hasAnyGrantId = (ownedGrantIds: ReadonlySet<string>, grantIds: readonly string[]) =>
	grantIds.some((grantId) => ownedGrantIds.has(grantId));

const readMissingGrantRequirementLabels = ({
	config,
	grantIds,
	selector,
}: {
	config: GameConfig;
	grantIds: ReadonlySet<string>;
	selector: ResolvedDomainSelector;
}): GrantRequirementLabel[] => {
	if ("mode" in selector) return [];

	const grantNameById = readGrantNameById(config);
	const labels: GrantRequirementLabel[] = [];

	for (const clause of selector.allOf ?? []) {
		if (hasAnyGrantId(grantIds, clause.ids)) continue;
		labels.push(
			readGrantClauseLabel({
				config,
				grantIds: clause.ids,
				grantNameById,
			}),
		);
	}

	if (selector.anyOf && !selector.anyOf.some((clause) => hasAnyGrantId(grantIds, clause.ids))) {
		labels.push({
			label: `One of ${selector.anyOf
				.flatMap((clause) => clause.ids)
				.map(
					(grantId) =>
						readGrantRequirementLabel({
							config,
							grantId,
							grantNameById,
						}).label,
				)
				.join(" / ")}`,
		});
	}

	for (const clause of selector.noneOf ?? []) {
		if (!hasAnyGrantId(grantIds, clause.ids)) continue;
		labels.push({
			label: `Without ${clause.ids
				.filter((grantId) => grantIds.has(grantId))
				.map(
					(grantId) =>
						readGrantRequirementLabel({
							config,
							grantId,
							grantNameById,
						}).label,
				)
				.join(" / ")}`,
		});
	}

	return labels;
};

const evaluateCraftLineEffects = ({
	grantIds,
	recipe,
}: {
	grantIds: ReadonlySet<string>;
	recipe: GameCraftRecipeDefinition;
}): EvaluatedCraftLineEffect[] =>
	(recipe.effects ?? []).flatMap((lineEffect) => {
		if (lineEffect.kind !== "grant.require" && lineEffect.kind !== "grant.blockStart")
			return [];
		return [
			{
				lineEffect,
				selectorMatched: doesGameGrantSelectorMatchIds({
					grantIds,
					selector: lineEffect.selector,
				}),
			},
		];
	});

const readCraftLineEffectAnalysis = ({
	config,
	grantIds: providedGrantIds,
	nowMs,
	recipe,
	save,
}: readCraftLineEffectState.Props): CraftLineEffectAnalysis => {
	const grantIds = readCraftGrantIds({
		config,
		grantIds: providedGrantIds,
		nowMs,
		save,
	});
	const effects = evaluateCraftLineEffects({
		grantIds,
		recipe,
	});
	let startRequirementsReady = true;
	let blocked = false;
	const blockReasons: string[] = [];

	for (const { lineEffect, selectorMatched } of effects) {
		if (lineEffect.kind === "grant.require") {
			if (lineEffect.phase === "start" && !selectorMatched) startRequirementsReady = false;
			continue;
		}

		if (lineEffect.kind === "grant.blockStart" && selectorMatched) {
			blocked = true;
			blockReasons.push(lineEffect.reason ?? lineEffect.label ?? "Craft recipe is blocked.");
		}
	}

	return {
		blocked,
		blockReasons,
		effects,
		grantIds,
		startRequirementsReady,
		startGateReady: startRequirementsReady && !blocked,
	};
};

export const readCraftLineStartGateState = ({
	config,
	grantIds: providedGrantIds,
	nowMs,
	recipe,
	save,
}: readCraftLineStartGateState.Props): CraftLineStartGateState => {
	const { blocked, blockReasons, grantIds, startGateReady, startRequirementsReady } =
		readCraftLineEffectAnalysis({
			config,
			grantIds: providedGrantIds,
			nowMs,
			recipe,
			save,
		});

	return {
		blocked,
		blockReasons,
		grantIds,
		startGateReady,
		startRequirementsReady,
	};
};

export const readCraftLineEffectState = ({
	config,
	grantIds: providedGrantIds,
	nowMs,
	recipe,
	save,
}: readCraftLineEffectState.Props): CraftLineStartGateState & {
	requirements: CraftEffectRequirement[];
} => {
	const analysis = readCraftLineEffectAnalysis({
		config,
		grantIds: providedGrantIds,
		nowMs,
		recipe,
		save,
	});
	const { blocked, blockReasons, effects, grantIds, startGateReady, startRequirementsReady } =
		analysis;
	const requirements: CraftEffectRequirement[] = [];

	for (const { lineEffect, selectorMatched } of effects) {
		if (lineEffect.kind === "grant.require") {
			const ready = selectorMatched;
			const requirementLabels =
				lineEffect.label || lineEffect.reason || ready
					? [
							{
								label: lineEffect.label ?? lineEffect.reason ?? "Required grant",
							},
						]
					: readMissingGrantRequirementLabels({
							config,
							grantIds,
							selector: lineEffect.selector,
						});

			for (const requirementLabel of requirementLabels) {
				const requirement = {
					display: lineEffect.display,
					itemId: requirementLabel.itemId,
					kind: lineEffect.kind,
					label: requirementLabel.label,
					ready,
				};
				if (shouldDisplayCraftEffectRequirement(requirement))
					requirements.push(requirement);
			}
			continue;
		}

		if (lineEffect.kind !== "grant.blockStart") continue;
		const requirement = {
			display: lineEffect.display,
			kind: lineEffect.kind,
			label: lineEffect.reason ?? lineEffect.label ?? "Craft recipe is blocked.",
			ready: !selectorMatched,
		};
		if (shouldDisplayCraftEffectRequirement(requirement)) requirements.push(requirement);
	}

	return {
		blocked,
		blockReasons,
		grantIds,
		requirements,
		startGateReady,
		startRequirementsReady,
	};
};
