import {
	formatGameDiagnosticFailureTextFn,
	formatGameDiagnosticHistoryTextFn,
} from "~/game-incident/fn/formatGameDiagnosticSessionTextFn";
import { formatGameRuntimeDiffTextFn } from "~/game-incident/fn/formatGameRuntimeDiffTextFn";
import type { GameReplayReport } from "~/game-incident/type/GameReplayReport";

/** Formats a bounded production replay without dumping the complete runtime twice. */
export const formatGameReplayTextFn = (report: GameReplayReport): string => {
	const result =
		report.result === "fatal"
			? `Fatal failure reproduced after ${report.elapsedMs} ms.`
			: `No fatal failure was observed during the bounded ${report.elapsedMs} ms replay.`;
	return [
		"# Arkini game replay",
		"",
		result,
		"",
		`- Arkini application: ${report.applicationVersion}`,
		`- Package: ${report.packageId}`,
		`- Content hash: ${report.contentHash}`,
		`- Game version: ${report.gameVersion}`,
		`- Sequence: ${report.initialSequence} → ${report.finalSequence}`,
		`- Observed snapshots: ${report.observedSnapshots}`,
		`- Semantic transitions: ${report.semanticTransitions}`,
		"",
		formatGameRuntimeDiffTextFn({
			initial: report.initialRuntime,
			latest: report.finalRuntime,
		}),
		...(report.failure === null
			? []
			: [
					"",
					formatGameDiagnosticFailureTextFn(report.failure),
				]),
		"",
		formatGameDiagnosticHistoryTextFn(report.history),
	].join("\n");
};
