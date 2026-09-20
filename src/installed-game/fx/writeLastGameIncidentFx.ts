import { Effect } from "effect";

import { formatGameIncidentTextBundleFn } from "~/game-incident/fn/formatGameIncidentTextBundleFn";
import type { GameIncidentReport } from "~/game-incident/type/GameIncidentReport";
import type { SerapackDescriptor } from "~/serapack-catalog/type/SerapackDescriptor";

const reportIncidentWriteFailureFn = (cause: unknown) => {
	console.warn("Serakki could not write the latest game incident.", cause);
};

export namespace writeLastGameIncidentFx {
	export interface Props {
		readonly serapack: SerapackDescriptor;
		readonly report: GameIncidentReport;
		readonly saveBytes: Uint8Array;
	}
}

/** Starts the best-effort renderer-to-main write of one disposable failed-session environment. */
export const writeLastGameIncidentFx = Effect.fnUntraced(function* ({
	serapack,
	report,
	saveBytes,
}: writeLastGameIncidentFx.Props) {
	yield* Effect.sync(() => {
		const writer = window.serakki?.incident;
		if (writer === undefined) return;
		void writer
			.writeFn({
				serapack: {
					packageId: serapack.packageId,
					contentHash: serapack.contentHash,
					source: serapack.source,
				},
				saveBytes: new Uint8Array(saveBytes),
				text: formatGameIncidentTextBundleFn(report),
			})
			.catch(reportIncidentWriteFailureFn);
	});
});
