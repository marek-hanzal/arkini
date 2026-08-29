import { Effect } from "effect";

import type { ArkpackStorage } from "~/renderer/arkpack/ArkpackStorage";
import { createElectronArkpackStorageFx } from "~/renderer/arkpack/createElectronArkpackStorageFx";
import { readArkpackFx } from "~/renderer/arkpack/readArkpackFx";

export namespace importArkpackFx {
	export interface Props {
		bytes: Uint8Array;
		filename: string;
		packageId?: string;
		storage?: ArkpackStorage;
	}
}

/** Validates and atomically persists one local arkpack descriptor and exact binary. */
export const importArkpackFx = Effect.fn("importArkpackFx")(function* ({
	bytes,
	filename,
	packageId,
	storage: providedStorage,
}: importArkpackFx.Props) {
	const storage = providedStorage ?? (yield* createElectronArkpackStorageFx());
	return yield* Effect.gen(function* () {
		const loaded = yield* readArkpackFx({
			bytes,
			filename,
			packageId,
			provenance: {
				type: "community",
			},
			source: "user",
		});
		yield* storage.writeFx(loaded.descriptor.packageId, bytes.slice().buffer);
		return loaded.descriptor;
	});
});
