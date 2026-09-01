import {
	formatGameDiagnosticFailureTextFn,
	formatGameDiagnosticHistoryTextFn,
} from "~/game-incident/fn/formatGameDiagnosticSessionTextFn";
import {
	formatGameDiagnosticItemPointerTextFn,
	formatGameDiagnosticItemReferenceTextFn,
} from "~/game-incident/fn/formatGameDiagnosticValueTextFn";
import type {
	GameDiagnosticRuntime,
	GameDiagnosticRuntimeItem,
} from "~/game-incident/type/GameDiagnosticRuntime";
import type { GameReplayReport } from "~/game-incident/type/GameReplayReport";

const readRuntimeItemIdFn = (item: GameDiagnosticRuntimeItem) =>
	item.item.runtimeItemId ?? "config-only";

const appendIdentityDiffFn = <Value>({
	formatFn,
	initial,
	label,
	latest,
	lines,
	readIdFn,
}: {
	readonly formatFn: (value: Value) => string;
	readonly initial: readonly Value[];
	readonly label: string;
	readonly latest: readonly Value[];
	readonly lines: string[];
	readonly readIdFn: (value: Value) => string;
}) => {
	const initialIds = new Set(initial.map(readIdFn));
	const latestIds = new Set(latest.map(readIdFn));
	const added = latest.filter((value) => !initialIds.has(readIdFn(value)));
	const removed = initial.filter((value) => !latestIds.has(readIdFn(value)));
	if (added.length === 0 && removed.length === 0) return false;
	lines.push("", `### ${label}`);
	for (const value of added) lines.push(`- Added: ${formatFn(value)}`);
	for (const value of removed) lines.push(`- Removed: ${formatFn(value)}`);
	return true;
};

const formatRuntimeDiffFn = ({
	initial,
	latest,
}: {
	readonly initial: GameDiagnosticRuntime;
	readonly latest: GameDiagnosticRuntime;
}) => {
	const lines = [
		"## Initial → final runtime changes",
		"",
		`- Items: ${initial.items.length} → ${latest.items.length}`,
		`- Jobs: ${initial.jobs.length} → ${latest.jobs.length}`,
		`- Queued requests: ${initial.queue.length} → ${latest.queue.length}`,
		`- Current space: ${initial.currentSpace} → ${latest.currentSpace}`,
	];
	const initialItems = new Map(
		initial.items.map((item) => [
			readRuntimeItemIdFn(item),
			item,
		]),
	);
	const changedItems = latest.items.filter((item) => {
		const previous = initialItems.get(readRuntimeItemIdFn(item));
		return (
			previous !== undefined &&
			(previous.quantity !== item.quantity ||
				previous.remainingCharges !== item.remainingCharges ||
				previous.remainingDurationMs !== item.remainingDurationMs ||
				JSON.stringify(previous.location) !== JSON.stringify(item.location))
		);
	});
	let hasRuntimeChange =
		initial.items.length !== latest.items.length ||
		initial.jobs.length !== latest.jobs.length ||
		initial.queue.length !== latest.queue.length ||
		initial.currentSpace !== latest.currentSpace ||
		changedItems.length > 0;
	hasRuntimeChange =
		appendIdentityDiffFn({
			lines,
			label: "Item membership",
			initial: initial.items,
			latest: latest.items,
			readIdFn: readRuntimeItemIdFn,
			formatFn: (item) => formatGameDiagnosticItemReferenceTextFn(item.item),
		}) || hasRuntimeChange;
	if (changedItems.length > 0) {
		lines.push("", "### Items changed");
		for (const item of changedItems) {
			const previous = initialItems.get(readRuntimeItemIdFn(item));
			if (previous === undefined) continue;
			const changes = [
				...(previous.quantity === item.quantity
					? []
					: [
							`quantity ${previous.quantity} → ${item.quantity}`,
						]),
				...(previous.remainingCharges === item.remainingCharges
					? []
					: [
							`charges ${previous.remainingCharges ?? "none"} → ${item.remainingCharges ?? "none"}`,
						]),
				...(previous.remainingDurationMs === item.remainingDurationMs
					? []
					: [
							`remaining duration ${previous.remainingDurationMs ?? "none"} → ${item.remainingDurationMs ?? "none"} ms`,
						]),
				...(JSON.stringify(previous.location) === JSON.stringify(item.location)
					? []
					: [
							`location ${JSON.stringify(previous.location)} → ${JSON.stringify(item.location)}`,
						]),
			];
			lines.push(
				`- ${formatGameDiagnosticItemReferenceTextFn(item.item)} · ${changes.join(" · ")}`,
			);
		}
	}
	hasRuntimeChange =
		appendIdentityDiffFn({
			lines,
			label: "Jobs",
			initial: initial.jobs,
			latest: latest.jobs,
			readIdFn: (job) => job.jobId,
			formatFn: (job) =>
				`${job.jobId} · line ${job.lineId} · owner ${formatGameDiagnosticItemPointerTextFn(job.owner)}`,
		}) || hasRuntimeChange;
	hasRuntimeChange =
		appendIdentityDiffFn({
			lines,
			label: "Queue",
			initial: initial.queue,
			latest: latest.queue,
			readIdFn: (request) => request.requestId,
			formatFn: (request) =>
				`${request.requestId} · line ${request.lineId} · owner ${formatGameDiagnosticItemPointerTextFn(request.owner)}`,
		}) || hasRuntimeChange;
	if (!hasRuntimeChange) lines.push("", "No runtime change was observed.");
	return lines.join("\n");
};

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
		formatRuntimeDiffFn({
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
