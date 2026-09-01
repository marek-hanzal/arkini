import {
	formatGameDiagnosticItemPointerTextFn,
	formatGameDiagnosticItemReferenceTextFn,
	formatGameDiagnosticValueTextFn,
} from "~/game-incident/fn/formatGameDiagnosticValueTextFn";
import type { GameDiagnosticHistory } from "~/game-incident/schema/GameDiagnosticHistorySchema";
import type { GameDiagnosticFailure } from "~/game-incident/type/GameDiagnosticFailure";
import type { GameDiagnosticSession } from "~/game-incident/type/GameDiagnosticSession";
import type { GameDiagnosticSessionTextSection } from "~/game-incident/type/GameDiagnosticTextSection";

const indentTextFn = (value: string, indentation = "  ") =>
	value
		.split("\n")
		.map((line) => `${indentation}${line}`)
		.join("\n");

const hasDiagnosticDetailFn = (value: unknown): boolean => {
	if (value === null) return false;
	if (Array.isArray(value)) return value.length > 0;
	if (typeof value === "object") return Object.keys(value).length > 0;
	return true;
};

const formatSummaryFn = (session: GameDiagnosticSession) => {
	const { identity, source } = session;
	const failure = session.failure;
	const history = session.history;
	const firstSequence = history.entries[0]?.sequence;
	const lastSequence = history.entries.at(-1)?.sequence;
	return [
		"# Game diagnostic session",
		"",
		`- Session: ${identity.sessionId}`,
		`- Arkini application: ${identity.applicationVersion}`,
		`- Package: ${identity.packageId}`,
		`- Content hash: ${identity.contentHash}`,
		`- Game version: ${identity.gameVersion}`,
		`- Arkini writer: ${identity.arkiniVersion}`,
		`- Restored save: ${identity.restored ? "yes" : "no"}`,
		`- Started: ${identity.startedAt}`,
		...(failure === null
			? [
					"- Failure: none in the selected records",
				]
			: [
					`- Failure: ${failure.source} at sequence ${failure.sequence}`,
				]),
		`- History: ${history.entries.length} retained of ${history.totalEntries} semantic records${firstSequence === undefined ? "" : `, sequences ${firstSequence}–${lastSequence}`}`,
		`- Parsed records: ${source.parsedRecords} from ${source.fileCount} source file${source.fileCount === 1 ? "" : "s"}`,
		`- Input warnings: ${source.issues.length}`,
		...(source.issues.length === 0
			? []
			: [
					"",
					"## Input warnings",
					"",
					...source.issues.map(
						(issue) => `- Input ${issue.file}, line ${issue.line} — ${issue.message}`,
					),
				]),
	].join("\n");
};

export const formatGameDiagnosticFailureTextFn = (failure: GameDiagnosticFailure | null) => {
	if (failure === null)
		return "# Failure\n\nNo fatal failure was present in the selected records.";
	return [
		"# Failure",
		"",
		`- Source: ${failure.source}`,
		`- Sequence: ${failure.sequence}`,
		`- Observed: ${failure.observedAt}`,
		`- Error data truncated: ${failure.errorTruncated ? "yes" : "no"}`,
		`- Related item identities truncated: ${failure.relatedItemsTruncated ? "yes" : "no"}`,
		"",
		"## Related items",
		"",
		...(failure.relatedItems.length === 0
			? [
					"No item identity could be resolved from the failure.",
				]
			: failure.relatedItems.map(
					(item) => `- ${formatGameDiagnosticItemReferenceTextFn(item)}`,
				)),
		"",
		"## Error",
		"",
		formatGameDiagnosticValueTextFn(failure.error),
	].join("\n");
};

export const formatGameDiagnosticHistoryTextFn = (history: GameDiagnosticHistory) => {
	const lines = [
		"# Semantic history",
		"",
		`Retained ${history.entries.length} of ${history.totalEntries} records; limit ${history.retainedLimit}.`,
	];
	const truncatedEntries = history.entries.filter((entry) => entry.truncated).length;
	if (history.totalEntries > history.entries.length) {
		lines.push(
			`${history.totalEntries - history.entries.length} older semantic records were omitted by the bounded history.`,
		);
	}
	if (truncatedEntries > 0) {
		lines.push(
			`${truncatedEntries} retained record${truncatedEntries === 1 ? " contains" : "s contain"} truncated or unavailable detail.`,
		);
	}
	const itemReferences = history.entries.flatMap((entry) => [
		...entry.events.flatMap((event) => event.relatedItems),
		...entry.jobsAdded.map((job) => job.owner),
		...entry.jobsRemoved.map((job) => job.owner),
		...entry.queueAdded.map((request) => request.owner),
		...entry.queueRemoved.map((request) => request.owner),
		...entry.defaultLinesChanged.map((change) => change.owner),
		...entry.deliveries.map((delivery) => delivery.item),
	]);
	const seenItemReferences = new Set<string>();
	const uniqueItemReferences = itemReferences.filter((reference) => {
		const key = formatGameDiagnosticItemPointerTextFn(reference);
		if (seenItemReferences.has(key)) return false;
		seenItemReferences.add(key);
		return true;
	});
	if (uniqueItemReferences.length > 0) {
		lines.push("", "## Item identities", "");
		for (const reference of uniqueItemReferences) {
			lines.push(`- ${formatGameDiagnosticItemReferenceTextFn(reference)}`);
		}
	}
	for (const entry of history.entries) {
		lines.push(
			"",
			`## Sequence ${entry.sequence} · ${entry.observedAt}${entry.elapsedSincePreviousMs === null ? "" : ` · +${entry.elapsedSincePreviousMs} ms`}`,
			"",
			...(entry.initial
				? [
						"Initial observed snapshot.",
					]
				: []),
			`State: ${entry.itemCount} items, ${entry.jobCount} jobs, ${entry.queueCount} queued requests.`,
		);
		if (entry.events.length > 0) {
			lines.push("", "Events:");
			for (const event of entry.events) {
				lines.push(`- ${event.type}`);
				for (const item of event.relatedItems) {
					lines.push(`  - Item: ${formatGameDiagnosticItemPointerTextFn(item)}`);
				}
				if (hasDiagnosticDetailFn(event.details)) {
					lines.push(indentTextFn(formatGameDiagnosticValueTextFn(event.details), "  "));
				}
			}
		}
		const appendJobsFn = (
			label: string,
			jobs: typeof entry.jobsAdded | typeof entry.jobsRemoved,
		) => {
			if (jobs.length === 0) return;
			lines.push("", `${label}:`);
			for (const job of jobs) {
				lines.push(
					`- ${job.jobId} · line ${job.lineId} · owner ${formatGameDiagnosticItemPointerTextFn(job.owner)}`,
				);
			}
		};
		appendJobsFn("Jobs added", entry.jobsAdded);
		appendJobsFn("Jobs removed", entry.jobsRemoved);
		const appendQueueFn = (
			label: string,
			requests: typeof entry.queueAdded | typeof entry.queueRemoved,
		) => {
			if (requests.length === 0) return;
			lines.push("", `${label}:`);
			for (const request of requests) {
				lines.push(
					`- ${request.requestId} · line ${request.lineId} · owner ${formatGameDiagnosticItemPointerTextFn(request.owner)}`,
				);
			}
		};
		appendQueueFn("Queue added", entry.queueAdded);
		appendQueueFn("Queue removed", entry.queueRemoved);
		if (entry.defaultLinesChanged.length > 0) {
			lines.push("", "Default lines changed:");
			for (const change of entry.defaultLinesChanged) {
				lines.push(
					`- ${formatGameDiagnosticItemPointerTextFn(change.owner)} · ${change.previousLineId ?? "none"} → ${change.lineId ?? "none"}`,
				);
			}
		}
		if (entry.deliveries.length > 0) {
			lines.push("", "Active deliveries:");
			for (const delivery of entry.deliveries) {
				lines.push(
					`- ${formatGameDiagnosticItemPointerTextFn(delivery.item)} · quantity ${delivery.quantity} · ${delivery.phase} generation ${delivery.generation}`,
				);
			}
		}
	}
	return lines.join("\n");
};

/** Formats one selected diagnostic session as concise, stable Markdown-flavoured text. */
export const formatGameDiagnosticSessionTextFn = ({
	section,
	session,
}: {
	readonly section: GameDiagnosticSessionTextSection;
	readonly session: GameDiagnosticSession;
}): string => {
	switch (section) {
		case "summary":
			return formatSummaryFn(session);
		case "failure":
			return formatGameDiagnosticFailureTextFn(session.failure);
		case "history":
			return formatGameDiagnosticHistoryTextFn(session.history);
		case "all":
			return [
				formatSummaryFn(session),
				formatGameDiagnosticFailureTextFn(session.failure),
				formatGameDiagnosticHistoryTextFn(session.history),
			].join("\n\n---\n\n");
	}
};
