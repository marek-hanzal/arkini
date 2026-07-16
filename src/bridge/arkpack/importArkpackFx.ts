import { Effect } from "effect";

import type { ArkpackStorage } from "~/bridge/arkpack/ArkpackStorage";
import { createArkpackStorage } from "~/bridge/arkpack/createArkpackStorage";
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
	const storage = providedStorage ?? createArkpackStorage();
	const importedAtMs = Date.now();
	return yield* Effect.gen(function* () {
		const loaded = yield* readArkpackFx({
			bytes,
			filename,
			importedAtMs,
			source: "imported",
		});
		yield* Effect.tryPromise({
			try: () => storage.write(loaded.descriptor, bytes.slice().buffer),
			catch: (cause) => cause,
		});
		return loaded.descriptor;
	}).pipe(Effect.ensuring(Effect.sync(() => providedStorage === undefined && storage.close())));
});
