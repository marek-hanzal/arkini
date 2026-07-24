import { Effect } from "effect";

import type { ArkpackStorage } from "~/bridge/arkpack/ArkpackStorage";
import { ArkiniTrustedKeys } from "~/bridge/arkpack/ArkiniTrustedKeys";
import { createArkpackStorageFx } from "~/bridge/arkpack/createArkpackStorageFx";
import { readArkpackFx } from "~/bridge/arkpack/readArkpackFx";

export namespace importArkpackFx {
	export interface Props {
		bytes: Uint8Array;
		filename: string;
		storage?: ArkpackStorage;
	}
}

/** Validates and atomically persists one local arkpack descriptor and exact binary. */
export const importArkpackFx = Effect.fn("importArkpackFx")(function* ({
	bytes,
	filename,
	storage: providedStorage,
}: importArkpackFx.Props) {
	const storage = providedStorage ?? (yield* createArkpackStorageFx());
	const importedAtMs = Date.now();
	return yield* Effect.gen(function* () {
		const loaded = yield* readArkpackFx({
			bytes,
			filename,
			importedAtMs,
			source: "imported",
			trustedKeys: ArkiniTrustedKeys,
		});
		yield* storage.writeFx(loaded.descriptor, bytes.slice().buffer);
		return loaded.descriptor;
	});
});
