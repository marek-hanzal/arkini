import type { DiagnosticValue } from "~electron/contract/diagnostics/DiagnosticRecord";

export namespace formatDiagnosticValueTextFn {
	export interface Props {
		readonly value: DiagnosticValue;
		readonly redactPaths: boolean;
	}
}

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

const appendValueFn = (
	lines: string[],
	value: DiagnosticValue,
	indent: string,
	redactPaths: boolean,
	label?: string,
) => {
	const formatStringFn = redactPaths ? redactDiagnosticPathsFn : (candidate: string) => candidate;
	const renderedLabel = label === undefined ? undefined : formatStringFn(label);
	const prefix = renderedLabel === undefined ? indent : `${indent}${renderedLabel}:`;
	if (value === null || typeof value === "boolean" || typeof value === "number") {
		lines.push(`${prefix}${renderedLabel === undefined ? "" : " "}${String(value)}`);
		return;
	}
	if (typeof value === "string") {
		const formatted = formatStringFn(value);
		if (renderedLabel === "stack") {
			lines.push(prefix);
			for (const stackLine of formatStackFn(formatted)) lines.push(`${indent}  ${stackLine}`);
			return;
		}
		if (formatted.includes("\n")) {
			lines.push(prefix);
			for (const line of formatted.split(/\r?\n/)) lines.push(`${indent}  ${line}`);
			return;
		}
		lines.push(`${prefix}${renderedLabel === undefined ? "" : " "}${formatted}`);
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
					for (const line of formatStringFn(entry).split(/\r?\n/))
						lines.push(`${indent}    ${line}`);
				} else {
					lines.push(
						`${indent}  - ${typeof entry === "string" ? formatStringFn(entry) : String(entry)}`,
					);
				}
				continue;
			}
			lines.push(`${indent}  -`);
			appendValueFn(lines, entry, `${indent}    `, redactPaths);
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
	for (const [key, entry] of entries) appendValueFn(lines, entry, childIndent, redactPaths, key);
};

/** Formats bounded diagnostics for human logs without exposing JSON syntax. */
export const formatDiagnosticValueTextFn = ({
	value,
	redactPaths,
}: formatDiagnosticValueTextFn.Props): string => {
	const lines: string[] = [];
	appendValueFn(lines, value, "", redactPaths);
	return lines.join("\n");
};
