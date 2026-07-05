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

const main = async () => {
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
			config: await loadGameConfigPackFromFile("game/arkini.game.arkpack"),
			label: "game/arkini.game.arkpack",
		}),
		...auditConfig({
			config: await validateSources([
				"game/arkini",
			]),
			label: "game/arkini",
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
