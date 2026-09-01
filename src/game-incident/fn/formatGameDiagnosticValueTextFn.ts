import type { DiagnosticValue } from "~electron/contract/diagnostics/DiagnosticRecord";
import type { GameDiagnosticItemReferenceSchema } from "~/game-incident/schema/GameDiagnosticReferenceSchema";

const redactDiagnosticPathsFn = (value: string) =>
	value
		.replace(/file:\/\/\/[^\s)\]}"']+/gu, "<redacted-path>")
		.replace(/(^|[\s("'=])\/(?!\/)[^\s)\]}"']+/gu, "$1<redacted-path>")
		.replace(/[A-Za-z]:\\[^\s)\]}"']+/gu, "<redacted-path>");

const formatStackFn = (stack: string): readonly string[] => {
	const lines = stack.split(/\r?\n/).filter((line) => line.trim().length > 0);
	if (lines.length <= 1) return lines;
	const message = lines[0] ?? "Error";
	const frames = lines.slice(1);
	const arkiniFrames = frames.filter(
		(line) =>
			line.includes("/src/") ||
			line.includes("/electron/") ||
			line.includes("/shared/") ||
			line.includes(".out/desktop/build"),
	);
	const retained = arkiniFrames.length === 0 ? frames.slice(0, 4) : arkiniFrames.slice(0, 8);
	const omitted = frames.length - retained.length;
	return [
		message,
		...retained,
		...(omitted === 0
			? []
			: [
					`... ${omitted} internal or external stack frames omitted`,
				]),
	];
};

const appendValueFn = (lines: string[], value: DiagnosticValue, indent: string, label?: string) => {
	const renderedLabel = label === undefined ? undefined : redactDiagnosticPathsFn(label);
	const prefix = renderedLabel === undefined ? indent : `${indent}${renderedLabel}:`;
	if (value === null || typeof value === "boolean" || typeof value === "number") {
		lines.push(`${prefix}${renderedLabel === undefined ? "" : " "}${String(value)}`);
		return;
	}
	if (typeof value === "string") {
		const redacted = redactDiagnosticPathsFn(value);
		if (renderedLabel === "stack") {
			lines.push(prefix);
			for (const stackLine of formatStackFn(redacted)) lines.push(`${indent}  ${stackLine}`);
			return;
		}
		if (redacted.includes("\n")) {
			lines.push(prefix);
			for (const line of redacted.split(/\r?\n/)) lines.push(`${indent}  ${line}`);
			return;
		}
		lines.push(`${prefix}${renderedLabel === undefined ? "" : " "}${redacted}`);
		return;
	}
	if (Array.isArray(value)) {
		lines.push(prefix);
		if (value.length === 0) {
			lines.push(`${indent}  (none)`);
			return;
		}
		for (const entry of value) {
			if (entry === null || typeof entry !== "object") {
				if (typeof entry === "string" && entry.includes("\n")) {
					lines.push(`${indent}  -`);
					for (const line of redactDiagnosticPathsFn(entry).split(/\r?\n/))
						lines.push(`${indent}    ${line}`);
				} else {
					lines.push(
						`${indent}  - ${typeof entry === "string" ? redactDiagnosticPathsFn(entry) : String(entry)}`,
					);
				}
				continue;
			}
			lines.push(`${indent}  -`);
			appendValueFn(lines, entry, `${indent}    `);
		}
		return;
	}
	if (renderedLabel !== undefined) lines.push(prefix);
	const childIndent = renderedLabel === undefined ? indent : `${indent}  `;
	const entries = Object.entries(value);
	if (entries.length === 0) {
		lines.push(`${childIndent}(none)`);
		return;
	}
	for (const [key, entry] of entries) appendValueFn(lines, entry, childIndent, key);
};

/** Formats bounded diagnostic data without exposing JSON syntax or unbounded stack noise. */
export const formatGameDiagnosticValueTextFn = (value: DiagnosticValue): string => {
	const lines: string[] = [];
	appendValueFn(lines, value, "");
	return lines.join("\n");
};

export const formatGameDiagnosticItemReferenceTextFn = (
	reference: GameDiagnosticItemReferenceSchema.Type,
): string => {
	const runtime =
		reference.runtimeItemId === null ? "" : ` · runtime-id ${reference.runtimeItemId}`;
	return reference.definition === null
		? `Config identity unavailable${runtime}`
		: `${reference.definition.title} · config-uid ${reference.definition.itemUid} · authored-id ${reference.definition.itemId}${runtime}`;
};

/** Formats the shortest exact identity used after a text section defines its item catalog. */
export const formatGameDiagnosticItemPointerTextFn = (
	reference: GameDiagnosticItemReferenceSchema.Type,
): string =>
	reference.runtimeItemId ??
	(reference.definition === null
		? "unresolved-item"
		: `config-uid ${reference.definition.itemUid}`);
