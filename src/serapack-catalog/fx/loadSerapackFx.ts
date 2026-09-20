import { Effect } from "effect";

import type { SerapackStorage } from "~/serapack-catalog/service/SerapackStorage";
import { createElectronSerapackStorageFx } from "~/serapack-catalog/fx/createElectronSerapackStorageFx";
import { readSerapackCandidatesFx } from "~/serapack-catalog/fx/readSerapackCandidatesFx";

export namespace loadSerapackFx {
	export interface Props {
		packageId: string;
		storage?: SerapackStorage;
	}
}

/** Loads and revalidates a bundled or persisted package binary before game bootstrap. */
export const loadSerapackFx = Effect.fn("loadSerapackFx")(function* ({
	packageId,
	storage: providedStorage,
}: loadSerapackFx.Props) {
	const storage = providedStorage ?? (yield* createElectronSerapackStorageFx());
	return yield* Effect.gen(function* () {
		const candidates = yield* storage.readFx(packageId);
		const loaded = yield* readSerapackCandidatesFx(candidates);
		if (loaded === undefined) {
			return yield* Effect.fail(new Error(`Serapack ${packageId} is not installed.`));
		}
		return loaded;
	});
});
