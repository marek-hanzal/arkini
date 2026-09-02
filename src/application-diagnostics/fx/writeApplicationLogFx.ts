import { Effect } from "effect";

import type { ApplicationLogRecordSchema } from "~electron/contract/diagnostics/ApplicationLogRecord";

let warnedAboutApplicationLogFailure = false;

const reportApplicationLogFailureFn = (cause: unknown) => {
	if (warnedAboutApplicationLogFailure) return;
	warnedAboutApplicationLogFailure = true;
	console.warn("Arkini application diagnostics are unavailable.", cause);
};

/** Isolates renderer log transport failure from the application failure being reported. */
export const writeApplicationLogFx = Effect.fnUntraced(function* (
	record: ApplicationLogRecordSchema.Type,
) {
	try {
		const diagnostics = window.arkini?.diagnostics;
		if (diagnostics === undefined) return;
		void diagnostics.writeApplicationFn(record).catch(reportApplicationLogFailureFn);
	} catch (cause) {
		reportApplicationLogFailureFn(cause);
	}
});
