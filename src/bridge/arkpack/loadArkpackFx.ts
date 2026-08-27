import { Effect } from "effect";

import type { ArkpackStorage } from "~/bridge/arkpack/ArkpackStorage";
import { createArkpackStorageFx } from "~/bridge/arkpack/createArkpackStorageFx";
import { readArkpackCandidatesFx } from "~/bridge/arkpack/readArkpackCandidatesFx";

export namespace loadArkpackFx {
	export interface Props {
		packageId: string;
		storage?: ArkpackStorage;
	}
}

/** Loads and revalidates a bundled or persisted package binary before game bootstrap. */
export const loadArkpackFx = Effect.fn("loadArkpackFx")(function* ({
	packageId,
	storage: providedStorage,
}: loadArkpackFx.Props) {
	const storage = providedStorage ?? (yield* createArkpackStorageFx());
	return yield* Effect.gen(function* () {
		const candidates = yield* storage.readFx(packageId);
		const loaded = yield* readArkpackCandidatesFx(candidates);
		if (loaded === undefined) {
			return yield* Effect.fail(new Error(`Arkpack ${packageId} is not installed.`));
		}
		return loaded;
	});
});
