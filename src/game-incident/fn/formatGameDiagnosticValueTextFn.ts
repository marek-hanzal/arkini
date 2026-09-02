import type { DiagnosticValue } from "~electron/contract/diagnostics/DiagnosticRecord";
import { formatDiagnosticValueTextFn } from "~/application-diagnostics/fn/formatDiagnosticValueTextFn";
import type { GameDiagnosticItemReferenceSchema } from "~/game-incident/schema/GameDiagnosticReferenceSchema";

/** Formats bounded diagnostic data without exposing JSON syntax or unbounded stack noise. */
export const formatGameDiagnosticValueTextFn = (value: DiagnosticValue): string => {
	return formatDiagnosticValueTextFn({
		value,
		redactPaths: true,
	});
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
