import { Effect } from "effect";

import type { ArkpackStorage } from "~/arkpack-catalog/service/ArkpackStorage";
import { createElectronArkpackStorageFx } from "~/arkpack-catalog/fx/createElectronArkpackStorageFx";

export namespace importArkpackFileFx {
	export interface Props {
		readonly storage?: ArkpackStorage;
	}
}

/** Lets main select, stream-validate, and persist one local Arkpack. */
export const importArkpackFileFx = Effect.fn("importArkpackFileFx")(function* (
	props: importArkpackFileFx.Props = {},
) {
	const storage = props.storage ?? (yield* createElectronArkpackStorageFx());
	if (storage.importFx === undefined)
		return yield* Effect.fail(new Error("Arkpack file import is unavailable."));
	const imported = yield* storage.importFx;
	return imported === null
		? null
		: {
				packageId: imported.packageId,
				contentHash: imported.contentHash,
				title: imported.title,
				version: imported.version,
				arkini: imported.arkini,
				provenance: imported.provenance,
				source: imported.source,
				overridesBundled: imported.overridesBundled,
				filename: imported.filename,
			};
});
