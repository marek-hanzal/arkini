#!/usr/bin/env node
import { validateSources } from "../game/package";
import { loadGameConfigPackFromFile } from "../../src/config/pack/loadGameConfigPackFromFile";
import type { AuditFinding } from "./audit/AuditFinding";
import { auditConfig } from "./audit/auditConfigModel";
import { auditFileSizeGuardrails } from "./audit/auditFileSizeGuardrails";
import { auditForbiddenDirectories, auditText } from "./audit/auditForbiddenRuntimeArtifacts";
import {
	auditEffectFunctionNames,
	auditForbiddenLogicDirectories,
	auditIndexBarrels,
} from "./audit/auditSourceOwnership";
import {
	auditActiveEffectWriteBoundaries,
	auditBoardItemRemovalBoundaries,
	auditBoardItemWriteBoundaries,
	auditInventorySlotWriteBoundaries,
	auditJobRemovalBoundaries,
	auditJobWriteBoundaries,
	auditRuntimeStateWriteBoundaries,
	auditStoredInputWriteBoundaries,
} from "./audit/auditSaveMutationBoundaries";
import {
	auditEffectRunnerBoundaries,
	auditImpureIdGenerationBoundaries,
	auditRedundantSchemaTypeAliases,
} from "./audit/auditSchemaAndEffectBoundaries";

const readCanonicalJson = (value: unknown): string => JSON.stringify(readCanonicalValue(value));

const readCanonicalValue = (value: unknown): unknown => {
	if (Array.isArray(value)) return value.map(readCanonicalValue);
	if (!value || typeof value !== "object") return value;

	return Object.fromEntries(
		Object.entries(value as Record<string, unknown>)
			.sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
			.map(([key, entry]) => [
				key,
				readCanonicalValue(entry),
			]),
	);
};

const auditDefaultPackMatchesSources = ({
	packConfig,
	sourceConfig,
}: {
	packConfig: unknown;
	sourceConfig: unknown;
}): AuditFinding[] => {
	if (readCanonicalJson(packConfig) === readCanonicalJson(sourceConfig)) return [];

	return [
		{
			message:
				'Default game pack is stale compared to game/arkini sources. Run "npm run game:compile" and commit game/arkini.game.arkpack.',
			path: "game/arkini.game.arkpack",
		},
	];
};

const main = async () => {
	const packConfig = await loadGameConfigPackFromFile("game/arkini.game.arkpack");
	const sourceConfig = await validateSources([
		"game/arkini",
	]);
	const findings: AuditFinding[] = [
		...auditForbiddenDirectories(),
		...auditText(),
		...auditIndexBarrels(),
		...auditForbiddenLogicDirectories(),
		...auditEffectFunctionNames(),
		...auditFileSizeGuardrails(),
		...auditBoardItemRemovalBoundaries(),
		...auditBoardItemWriteBoundaries(),
		...auditRuntimeStateWriteBoundaries(),
		...auditInventorySlotWriteBoundaries(),
		...auditJobRemovalBoundaries(),
		...auditJobWriteBoundaries(),
		...auditActiveEffectWriteBoundaries(),
		...auditStoredInputWriteBoundaries(),
		...auditRedundantSchemaTypeAliases(),
		...auditImpureIdGenerationBoundaries(),
		...auditEffectRunnerBoundaries(),
		...auditConfig({
			config: packConfig,
			label: "game/arkini.game.arkpack",
		}),
		...auditConfig({
			config: sourceConfig,
			label: "game/arkini",
		}),
		...auditDefaultPackMatchesSources({
			packConfig,
			sourceConfig,
		}),
	];

	if (findings.length === 0) {
		console.log("Active codebase audit passed.");
		return;
	}

	console.error("Active codebase audit failed:");
	for (const finding of findings) {
		console.error(`  - ${finding.path}: ${finding.message}`);
	}
	process.exitCode = 1;
};

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
