import {
	APPLICATION_LOG_BODY_MAX_LENGTH,
	type ApplicationLogRecordSchema,
} from "~electron/contract/diagnostics/ApplicationLogRecord";

import { formatDiagnosticValueTextFn } from "./formatDiagnosticValueTextFn";
import { toDiagnosticValueResultFn } from "./toDiagnosticValueFn";

const VALUE_TRUNCATION_MARKER = "... diagnostic value truncated during normalization";
const TEXT_TRUNCATION_MARKER = "... diagnostic text truncated during formatting";

export namespace formatApplicationDiagnosticTextFn {
	export interface Props {
		readonly value: unknown;
		readonly prefix?: string;
	}
}

const appendMarkersFn = (text: string, markers: ReadonlyArray<string>): string => {
	if (markers.length === 0) return text;
	const suffix = `\n${markers.join("\n")}`;
	return `${text.slice(0, APPLICATION_LOG_BODY_MAX_LENGTH - suffix.length).trimEnd()}${suffix}`;
};

/** Normalizes unknown application evidence and renders every truncation within the IPC limit. */
export const formatApplicationDiagnosticTextFn = ({
	value,
	prefix,
}: formatApplicationDiagnosticTextFn.Props): string => {
	const normalized = toDiagnosticValueResultFn(value);
	const detail = formatDiagnosticValueTextFn({
		value: normalized.value,
		redactPaths: false,
	});
	const text = prefix === undefined ? detail : `${prefix}\n\n${detail}`;
	const markers = [
		...(normalized.truncated
			? [
					VALUE_TRUNCATION_MARKER,
				]
			: []),
		...(text.length + (normalized.truncated ? VALUE_TRUNCATION_MARKER.length + 1 : 0) >
		APPLICATION_LOG_BODY_MAX_LENGTH
			? [
					TEXT_TRUNCATION_MARKER,
				]
			: []),
	];
	return appendMarkersFn(text, markers) satisfies ApplicationLogRecordSchema.Type["body"];
};
