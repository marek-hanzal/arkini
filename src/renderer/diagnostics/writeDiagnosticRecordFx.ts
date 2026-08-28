import { Effect } from "effect";

import type { DiagnosticRecord } from "../../../electron/contract/diagnostics/DiagnosticRecord";

let warnedAboutDiagnosticFailure = false;

const reportDiagnosticFailure = (cause: unknown) => {
	if (warnedAboutDiagnosticFailure) return;
	warnedAboutDiagnosticFailure = true;
	console.warn("Arkini diagnostics are unavailable.", cause);
};

/** Fire-and-forget renderer edge. Logger failures are deliberately isolated from gameplay. */
export const writeDiagnosticRecordFx = Effect.fnUntraced(function* (record: DiagnosticRecord) {
	try {
		const diagnostics = window.arkini?.diagnostics;
		if (diagnostics === undefined) return;
		void diagnostics.write(record).catch(reportDiagnosticFailure);
	} catch (cause) {
		reportDiagnosticFailure(cause);
	}
});
