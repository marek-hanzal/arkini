import { Effect } from "effect";

import { formatGameIncidentTextBundleFn } from "~/game-incident/fn/formatGameIncidentTextBundleFn";
import type { GameIncidentReport } from "~/game-incident/type/GameIncidentReport";

const reportIncidentWriteFailureFn = (cause: unknown) => {
	console.warn("Arkini could not write the latest game incident.", cause);
};

export namespace writeLastGameIncidentFx {
	export interface Props {
		readonly arkpackBytes: Uint8Array;
		readonly report: GameIncidentReport;
		readonly saveBytes: Uint8Array;
	}
}

/** Starts the best-effort renderer-to-main write of one disposable failed-session environment. */
export const writeLastGameIncidentFx = Effect.fnUntraced(function* ({
	arkpackBytes,
	report,
	saveBytes,
}: writeLastGameIncidentFx.Props) {
	yield* Effect.sync(() => {
		const writer = window.arkini?.incident;
		if (writer === undefined) return;
		void writer
			.writeFn({
				arkpackBytes: new Uint8Array(arkpackBytes),
				saveBytes: new Uint8Array(saveBytes),
				text: formatGameIncidentTextBundleFn(report),
			})
			.catch(reportIncidentWriteFailureFn);
	});
});
