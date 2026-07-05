import { z } from "zod";
import type { GameConfig } from "~/config/GameConfigTypes";
import { ResolvedDomainSelectorSchema } from "~/config/schema/GameDomainSelectorSchema";
import { readConfigEffects } from "~/config/validation/GameConfigValidationReaders";

export const formatIssuePath = (path: readonly (string | number)[]) =>
	path.map((segment) => String(segment)).join(".");

export const formatItemLabel = (config: GameConfig, itemId: string) => {
	const itemName = config.items[itemId]?.name;
	return itemName ? `"${itemId}" (${itemName})` : `"${itemId}"`;
};

export const formatItemSelector = (
	config: GameConfig,
	selector: z.infer<typeof ResolvedDomainSelectorSchema>,
) => formatResolvedSelector(selector, (itemId) => formatItemLabel(config, itemId));

export const formatGrantSelector = (
	config: GameConfig,
	selector: z.infer<typeof ResolvedDomainSelectorSchema>,
) => {
	const grantNameById = readGrantNameById(config);
	return formatResolvedSelector(selector, (grantId) => {
		const grantName = grantNameById.get(grantId);
		return grantName ? `"${grantId}" (${grantName})` : `"${grantId}"`;
	});
};

const formatResolvedSelector = (
	selector: z.infer<typeof ResolvedDomainSelectorSchema>,
	formatId: (id: string) => string,
) => {
	if ("mode" in selector) return 'mode "all"';

	const parts: string[] = [];
	const formatClauses = (label: "allOf" | "anyOf" | "noneOf") => {
		for (const clause of selector[label] ?? []) {
			parts.push(`${label} [${clause.ids.map(formatId).join(" OR ")}]`);
		}
	};

	formatClauses("anyOf");
	formatClauses("allOf");
	formatClauses("noneOf");

	return parts.join(", ") || "empty selector";
};

const readGrantNameById = (config: GameConfig) => {
	const grantNameById = new Map<string, string>();

	for (const { effect } of readConfigEffects(config)) {
		for (const grant of effect.grants) {
			grantNameById.set(grant.id, grant.name);
		}
	}

	return grantNameById;
};
