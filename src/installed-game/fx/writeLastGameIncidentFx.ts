import { Effect } from "effect";

import { formatGameIncidentTextBundleFn } from "~/game-incident/fn/formatGameIncidentTextBundleFn";
import type { GameIncidentReport } from "~/game-incident/type/GameIncidentReport";
import type { ArkpackDescriptor } from "~/arkpack-catalog/type/ArkpackDescriptor";

const reportIncidentWriteFailureFn = (cause: unknown) => {
	console.warn("Arkini could not write the latest game incident.", cause);
};

export namespace writeLastGameIncidentFx {
	export interface Props {
		readonly arkpack: ArkpackDescriptor;
		readonly report: GameIncidentReport;
		readonly saveBytes: Uint8Array;
	}
}

/** Starts the best-effort renderer-to-main write of one disposable failed-session environment. */
export const writeLastGameIncidentFx = Effect.fnUntraced(function* ({
	arkpack,
	report,
	saveBytes,
}: writeLastGameIncidentFx.Props) {
	yield* Effect.sync(() => {
		const writer = window.arkini?.incident;
		if (writer === undefined) return;
		void writer
			.writeFn({
				arkpack: {
					packageId: arkpack.packageId,
					contentHash: arkpack.contentHash,
					source: arkpack.source,
				},
				saveBytes: new Uint8Array(saveBytes),
				text: formatGameIncidentTextBundleFn(report),
			})
			.catch(reportIncidentWriteFailureFn);
	});
});
