import { Effect } from "effect";

import type { SerapackStorage } from "~/serapack-catalog/service/SerapackStorage";
import { createElectronSerapackStorageFx } from "~/serapack-catalog/fx/createElectronSerapackStorageFx";

export namespace importSerapackFileFx {
	export interface Props {
		readonly storage?: SerapackStorage;
	}
}

/** Lets main select, stream-validate, and persist one local Serapack. */
export const importSerapackFileFx = Effect.fn("importSerapackFileFx")(function* (
	props: importSerapackFileFx.Props = {},
) {
	const storage = props.storage ?? (yield* createElectronSerapackStorageFx());
	if (storage.importFx === undefined)
		return yield* Effect.fail(new Error("Serapack file import is unavailable."));
	const imported = yield* storage.importFx;
	return imported === null
		? null
		: {
				packageId: imported.packageId,
				contentHash: imported.contentHash,
				title: imported.title,
				version: imported.version,
				serakki: imported.serakki,
				projectRevision: imported.projectRevision,
				provenance: imported.provenance,
				source: imported.source,
				overridesBundled: imported.overridesBundled,
				filename: imported.filename,
			};
});
