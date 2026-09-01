import {
	formatGameDiagnosticFailureTextFn,
	formatGameDiagnosticHistoryTextFn,
} from "~/game-incident/fn/formatGameDiagnosticSessionTextFn";
import {
	formatGameDiagnosticItemPointerTextFn,
	formatGameDiagnosticItemReferenceTextFn,
	formatGameDiagnosticValueTextFn,
} from "~/game-incident/fn/formatGameDiagnosticValueTextFn";
import type {
	GameIncidentReport,
	GameIncidentTextBundle,
} from "~/game-incident/type/GameIncidentReport";

const indentTextFn = (value: string) =>
	value
		.split("\n")
		.map((line) => `  ${line}`)
		.join("\n");

const formatRuntimeFn = (report: GameIncidentReport) => {
	const runtime = report.runtime;
	const lines = [
		"# Last committed runtime state",
		"",
		`- Current space: ${runtime.currentSpace}`,
		`- Cheats enabled: ${runtime.cheats.enabled ? "yes" : "no"}`,
		`- Cheats ever enabled: ${runtime.cheats.everEnabled ? "yes" : "no"}`,
		`- Instant gameplay: ${runtime.cheats.instantGameplay ? "yes" : "no"}`,
		`- Items: ${runtime.items.length}`,
		`- Jobs: ${runtime.jobs.length}`,
		`- Queued requests: ${runtime.queue.length}`,
		"",
		"## Items",
	];
	if (runtime.items.length === 0) lines.push("", "No runtime items.");
	for (const item of runtime.items) {
		lines.push(
			"",
			`### ${formatGameDiagnosticItemReferenceTextFn(item.item)}`,
			"",
			`- Quantity: ${item.quantity}`,
			...(item.remainingCharges === undefined
				? []
				: [
						`- Remaining charges: ${item.remainingCharges}`,
					]),
			...(item.remainingDurationMs === undefined
				? []
				: [
						`- Remaining duration: ${item.remainingDurationMs} ms`,
					]),
			"- Location:",
			indentTextFn(formatGameDiagnosticValueTextFn(item.location)),
		);
	}
	lines.push("", "## Jobs", "");
	if (runtime.jobs.length === 0) lines.push("No active jobs.");
	for (const job of runtime.jobs) {
		lines.push(
			`- ${job.jobId} · line ${job.lineId} · owner ${formatGameDiagnosticItemPointerTextFn(job.owner)} · ${job.remainingMs}/${job.durationMs} ms remaining`,
		);
	}
	lines.push("", "## Queue", "");
	if (runtime.queue.length === 0) lines.push("No queued requests.");
	for (const request of runtime.queue) {
		lines.push(
			`- ${request.requestId} · line ${request.lineId} · owner ${formatGameDiagnosticItemPointerTextFn(request.owner)}`,
		);
	}
	lines.push("", "## Default lines", "");
	if (runtime.defaultLines.length === 0) lines.push("No explicit default lines.");
	for (const entry of runtime.defaultLines) {
		lines.push(
			`- ${formatGameDiagnosticItemPointerTextFn(entry.owner)} · ${entry.lineId ?? "disabled"}`,
		);
	}
	return lines.join("\n");
};

/** Renders one incident model into its fixed linked text bundle. */
export const formatGameIncidentTextBundleFn = (
	report: GameIncidentReport,
): GameIncidentTextBundle => {
	const { identity, history, failure, source } = report.diagnostics;
	const incident = [
		"# Arkini game incident",
		"",
		`- Captured: ${report.capturedAt}`,
		`- Arkini application: ${identity.applicationVersion}`,
		`- Session: ${identity.sessionId}`,
		`- Package: ${identity.packageId}`,
		`- Content hash: ${identity.contentHash}`,
		`- Game version: ${identity.gameVersion}`,
		`- Restored save: ${identity.restored ? "yes" : "no"}`,
		...(failure === null
			? [
					"- Failure: unavailable",
				]
			: [
					`- Failure: ${failure.source} at sequence ${failure.sequence}`,
				]),
		`- Semantic history: ${history.entries.length} retained of ${history.totalEntries}`,
		`- Input warnings: ${source.issues.length}`,
		"",
		"## Files",
		"",
		"- [Failure](./failure.md) — fatal source, related item identities and bounded error tree.",
		"- [Semantic history](./history.md) — bounded available events and identity deltas.",
		"- [Runtime state](./runtime-state.md) — complete latest committed runtime projection.",
		"- [Arkpack](./game.arkpack) — exact gameplay package loaded by the failed session.",
		"- [Save](./save.arksave) — exact latest committed state for replay.",
		...(source.issues.length === 0
			? []
			: [
					"",
					"## Capture warnings",
					"",
					...source.issues.map(
						(issue) => `- Input ${issue.file}, line ${issue.line} — ${issue.message}`,
					),
				]),
	].join("\n");
	return {
		incident,
		failure: formatGameDiagnosticFailureTextFn(failure),
		history: formatGameDiagnosticHistoryTextFn(history),
		runtimeState: formatRuntimeFn(report),
	};
};
