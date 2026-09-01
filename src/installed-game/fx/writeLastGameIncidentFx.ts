import { Effect } from "effect";

import type { GameIncidentWrite } from "~electron/contract/incident/GameIncidentWrite";

const reportIncidentWriteFailureFn = (cause: unknown) => {
	console.warn("Arkini could not write the latest game incident.", cause);
};

/** Starts the best-effort renderer-to-main write of one disposable failed-session environment. */
export const writeLastGameIncidentFx = Effect.fnUntraced(function* (incident: GameIncidentWrite) {
	yield* Effect.sync(() => {
		const writer = window.arkini?.incident;
		if (writer === undefined) return;
		void writer.writeFn(incident).catch(reportIncidentWriteFailureFn);
	});
});
