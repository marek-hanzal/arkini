import type { GameConfig } from "../../../src/config/GameConfigTypes";
import type { AuditFinding } from "./AuditFinding";

const forbiddenRootConfigKeys = [
	"effects",
	"products",
	"merges",
	"merge",
	"producers",
	"stashes",
	"craftRecipes",
	"requirements",
] as const;

const forbiddenEmbeddedConfigKeys = [
	"productIds",
	"mergeIds",
	"craftRecipeId",
	"producerIds",
	"stashIds",
	"passiveEffectIds",
	"activatesEffectId",
	"defaultProductId",
	"defaultEffectProductId",
	"requirementId",
	"requirementIds",
] as const;

export const auditConfig = ({
	config,
	label,
}: {
	config: GameConfig;
	label: string;
}): AuditFinding[] => {
	const findings: AuditFinding[] = [];
	for (const key of Object.keys(config)) {
		if (!isForbiddenRootConfigKey(key)) continue;
		findings.push({
			path: `${label}.${key}`,
			message: "root registry key is not part of the embedded capability config model",
		});
	}

	findForbiddenConfigFields(config, label, findings);
	return findings;
};

const findForbiddenConfigFields = (value: unknown, path: string, findings: AuditFinding[]) => {
	if (!value || typeof value !== "object") return;
	if (Array.isArray(value)) {
		for (const [index, entry] of value.entries()) {
			findForbiddenConfigFields(entry, `${path}[${index}]`, findings);
		}
		return;
	}

	for (const [key, entry] of Object.entries(value)) {
		if (isForbiddenEmbeddedConfigKey(key)) {
			findings.push({
				path: `${path}.${key}`,
				message: "removed config field is not part of the embedded capability model",
			});
		}
		findForbiddenConfigFields(entry, `${path}.${key}`, findings);
	}
};

const isForbiddenRootConfigKey = (key: string): key is (typeof forbiddenRootConfigKeys)[number] =>
	(forbiddenRootConfigKeys as readonly string[]).includes(key);

const isForbiddenEmbeddedConfigKey = (
	key: string,
): key is (typeof forbiddenEmbeddedConfigKeys)[number] =>
	(forbiddenEmbeddedConfigKeys as readonly string[]).includes(key);
