import {
	formatGameDiagnosticItemPointerTextFn,
	formatGameDiagnosticItemReferenceTextFn,
	formatGameDiagnosticValueTextFn,
} from "~/game-incident/fn/formatGameDiagnosticValueTextFn";
import type { DiagnosticValue } from "~electron/contract/diagnostics/DiagnosticRecord";
import type { GameDiagnosticItemReferenceSchema } from "~/game-incident/schema/GameDiagnosticReferenceSchema";
import type { GameDiagnosticRuntime } from "~/game-incident/type/GameDiagnosticRuntime";

const readItemReferenceIdFn = (reference: GameDiagnosticItemReferenceSchema.Type) =>
	reference.runtimeItemId ?? reference.definition?.itemUid ?? "unresolved-item";

const formatChangesFn = (changes: readonly (string | null)[]) => {
	const present = changes.filter((change): change is string => change !== null);
	return present.length === 0 ? null : present.join(" · ");
};

const formatCollectionDiffFn = <Value>({
	formatChangeFn,
	formatFn,
	initial,
	latest,
	readIdFn,
}: {
	readonly formatChangeFn: (initial: Value, latest: Value) => string | null;
	readonly formatFn: (value: Value) => string;
	readonly initial: readonly Value[];
	readonly latest: readonly Value[];
	readonly readIdFn: (value: Value) => string;
}) => {
	const initialById = new Map(
		initial.map((value) => [
			readIdFn(value),
			value,
		]),
	);
	const latestIds = new Set(latest.map(readIdFn));
	return [
		...latest
			.filter((value) => !initialById.has(readIdFn(value)))
			.map((value) => `- Added: ${formatFn(value)}`),
		...initial
			.filter((value) => !latestIds.has(readIdFn(value)))
			.map((value) => `- Removed: ${formatFn(value)}`),
		...latest.flatMap((value) => {
			const previous = initialById.get(readIdFn(value));
			if (previous === undefined) return [];
			const changes = formatChangeFn(previous, value);
			return changes === null
				? []
				: [
						`- Changed: ${formatFn(value)} · ${changes}`,
					];
		}),
	];
};

const formatBooleanFn = (value: boolean) => (value ? "yes" : "no");

const formatInlineDiagnosticValueFn = (value: DiagnosticValue) =>
	formatGameDiagnosticValueTextFn(value).replaceAll("\n", " ");

/** Renders every meaningful initial-to-final change in the diagnostic runtime projection. */
export const formatGameRuntimeDiffTextFn = ({
	initial,
	latest,
}: {
	readonly initial: GameDiagnosticRuntime;
	readonly latest: GameDiagnosticRuntime;
}): string => {
	const cheatLines = [
		...(initial.cheats.enabled === latest.cheats.enabled
			? []
			: [
					`- Enabled: ${formatBooleanFn(initial.cheats.enabled)} → ${formatBooleanFn(latest.cheats.enabled)}`,
				]),
		...(initial.cheats.everEnabled === latest.cheats.everEnabled
			? []
			: [
					`- Ever enabled: ${formatBooleanFn(initial.cheats.everEnabled)} → ${formatBooleanFn(latest.cheats.everEnabled)}`,
				]),
		...(initial.cheats.instantGameplay === latest.cheats.instantGameplay
			? []
			: [
					`- Instant gameplay: ${formatBooleanFn(initial.cheats.instantGameplay)} → ${formatBooleanFn(latest.cheats.instantGameplay)}`,
				]),
	];
	const itemLines = formatCollectionDiffFn({
		initial: initial.items,
		latest: latest.items,
		readIdFn: (item) => readItemReferenceIdFn(item.item),
		formatFn: (item) => formatGameDiagnosticItemReferenceTextFn(item.item),
		formatChangeFn: (previous, item) =>
			formatChangesFn([
				previous.quantity === item.quantity
					? null
					: `quantity ${previous.quantity} → ${item.quantity}`,
				previous.remainingCharges === item.remainingCharges
					? null
					: `charges ${previous.remainingCharges ?? "none"} → ${item.remainingCharges ?? "none"}`,
				previous.remainingDurationMs === item.remainingDurationMs
					? null
					: `remaining duration ${previous.remainingDurationMs ?? "none"} → ${item.remainingDurationMs ?? "none"} ms`,
				JSON.stringify(previous.location) === JSON.stringify(item.location)
					? null
					: `location ${formatInlineDiagnosticValueFn(previous.location)} → ${formatInlineDiagnosticValueFn(item.location)}`,
			]),
	});
	const jobLines = formatCollectionDiffFn({
		initial: initial.jobs,
		latest: latest.jobs,
		readIdFn: (job) => job.jobId,
		formatFn: (job) =>
			`${job.jobId} · line ${job.lineId} · owner ${formatGameDiagnosticItemPointerTextFn(job.owner)}`,
		formatChangeFn: (previous, job) =>
			formatChangesFn([
				previous.lineId === job.lineId ? null : `line ${previous.lineId} → ${job.lineId}`,
				readItemReferenceIdFn(previous.owner) === readItemReferenceIdFn(job.owner)
					? null
					: `owner ${formatGameDiagnosticItemPointerTextFn(previous.owner)} → ${formatGameDiagnosticItemPointerTextFn(job.owner)}`,
				previous.durationMs === job.durationMs
					? null
					: `duration ${previous.durationMs} → ${job.durationMs} ms`,
				previous.remainingMs === job.remainingMs
					? null
					: `remaining ${previous.remainingMs} → ${job.remainingMs} ms`,
			]),
	});
	const queueLines = formatCollectionDiffFn({
		initial: initial.queue,
		latest: latest.queue,
		readIdFn: (request) => request.requestId,
		formatFn: (request) =>
			`${request.requestId} · line ${request.lineId} · owner ${formatGameDiagnosticItemPointerTextFn(request.owner)}`,
		formatChangeFn: (previous, request) =>
			formatChangesFn([
				previous.lineId === request.lineId
					? null
					: `line ${previous.lineId} → ${request.lineId}`,
				readItemReferenceIdFn(previous.owner) === readItemReferenceIdFn(request.owner)
					? null
					: `owner ${formatGameDiagnosticItemPointerTextFn(previous.owner)} → ${formatGameDiagnosticItemPointerTextFn(request.owner)}`,
			]),
	});
	const initialQueueIds = initial.queue.map((request) => request.requestId);
	const latestQueueIds = latest.queue.map((request) => request.requestId);
	const sameQueueMembership =
		initialQueueIds.length === latestQueueIds.length &&
		initialQueueIds.every((requestId) => latestQueueIds.includes(requestId));
	if (
		sameQueueMembership &&
		initialQueueIds.some((requestId, index) => requestId !== latestQueueIds[index])
	) {
		queueLines.push(`- Order: ${initialQueueIds.join(", ")} → ${latestQueueIds.join(", ")}`);
	}
	const defaultLineLines = formatCollectionDiffFn({
		initial: initial.defaultLines,
		latest: latest.defaultLines,
		readIdFn: (entry) => readItemReferenceIdFn(entry.owner),
		formatFn: (entry) =>
			`${formatGameDiagnosticItemPointerTextFn(entry.owner)} · ${entry.lineId ?? "disabled"}`,
		formatChangeFn: (previous, entry) =>
			previous.lineId === entry.lineId
				? null
				: `line ${previous.lineId ?? "disabled"} → ${entry.lineId ?? "disabled"}`,
	});
	const sections = [
		{
			heading: "Cheats",
			lines: cheatLines,
		},
		{
			heading: "Items",
			lines: itemLines,
		},
		{
			heading: "Jobs",
			lines: jobLines,
		},
		{
			heading: "Queue",
			lines: queueLines,
		},
		{
			heading: "Default lines",
			lines: defaultLineLines,
		},
	].filter((section) => section.lines.length > 0);
	const lines = [
		"## Initial → final runtime changes",
		"",
		`- Items: ${initial.items.length} → ${latest.items.length}`,
		`- Jobs: ${initial.jobs.length} → ${latest.jobs.length}`,
		`- Queued requests: ${initial.queue.length} → ${latest.queue.length}`,
		`- Default lines: ${initial.defaultLines.length} → ${latest.defaultLines.length}`,
		`- Current space: ${initial.currentSpace} → ${latest.currentSpace}`,
	];
	for (const section of sections) {
		lines.push("", `### ${section.heading}`, ...section.lines);
	}
	if (initial.currentSpace === latest.currentSpace && sections.length === 0) {
		lines.push("", "No runtime change was observed.");
	}
	return lines.join("\n");
};
