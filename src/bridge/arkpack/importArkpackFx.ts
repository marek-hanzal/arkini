import { Effect } from "effect";

import type { ArkpackStorage } from "~/bridge/arkpack/ArkpackStorage";
import { DexieArkpackStorage } from "~/bridge/arkpack/DexieArkpackStorage";
import { readArkpackFx } from "~/bridge/arkpack/readArkpackFx";

export namespace importArkpackFx {
	export interface Props {
		bytes: Uint8Array;
		filename: string;
		storage?: ArkpackStorage;
	}
}

/** Validates and persists one local arkpack import under its exact content hash. */
export const importArkpackFx = Effect.fn("importArkpackFx")(function* ({
	bytes,
	filename,
	storage: providedStorage,
}: importArkpackFx.Props) {
	const storage = providedStorage ?? new DexieArkpackStorage();
	const importedAtMs = Date.now();
	return yield* Effect.gen(function* () {
		const loaded = yield* readArkpackFx({
			bytes,
			filename,
			importedAtMs,
			source: "imported",
		});
		yield* Effect.tryPromise({
			try: () =>
				storage.write({
					...loaded.descriptor,
					bytes: bytes.slice().buffer,
				}),
			catch: (cause) => cause,
		});
		return loaded.descriptor;
	}).pipe(Effect.ensuring(Effect.sync(() => providedStorage === undefined && storage.close())));
});
