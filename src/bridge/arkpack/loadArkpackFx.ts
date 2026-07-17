import { Effect } from "effect";

import type { ArkpackStorage } from "~/bridge/arkpack/ArkpackStorage";
import { ArkiniArkpack } from "~/bridge/arkpack/ArkiniArkpack";
import { createArkpackStorageFx } from "~/bridge/arkpack/createArkpackStorageFx";
import { readArkpackFx } from "~/bridge/arkpack/readArkpackFx";

export namespace loadArkpackFx {
	export interface Props {
		packageId: string;
		storage?: ArkpackStorage;
	}
}

const fetchArkiniBytes = Effect.tryPromise({
	try: async () => {
		const response = await fetch(ArkiniArkpack.url);
		if (!response.ok) {
			throw new Error(
				`Unable to load bundled Arkini pack: ${response.status} ${response.statusText}.`,
			);
		}
		return new Uint8Array(await response.arrayBuffer());
	},
	catch: (cause) => cause,
});

/** Loads and revalidates the official Arkini or a persisted package binary before game bootstrap. */
export const loadArkpackFx = Effect.fn("loadArkpackFx")(function* ({
	packageId,
	storage: providedStorage,
}: loadArkpackFx.Props) {
	if (packageId === ArkiniArkpack.packageId) {
		const loaded = yield* readArkpackFx({
			bytes: yield* fetchArkiniBytes,
			packageId,
			source: "built-in",
		});
		const expected = ArkiniArkpack.descriptor;
		if (
			loaded.descriptor.contentHash !== expected.contentHash ||
			loaded.descriptor.gameId !== expected.gameId ||
			loaded.descriptor.title !== expected.title ||
			loaded.descriptor.configVersion !== expected.configVersion ||
			loaded.descriptor.compressedSize !== expected.compressedSize
		) {
			return yield* Effect.fail(
				new Error("Bundled Arkini metadata does not match its exact package binary."),
			);
		}
		return loaded;
	}

	const storage = providedStorage ?? (yield* createArkpackStorageFx());
	return yield* Effect.gen(function* () {
		const record = yield* Effect.tryPromise({
			try: () => storage.read(packageId),
			catch: (cause) => cause,
		});
		if (record === undefined) {
			return yield* Effect.fail(new Error(`Arkpack ${packageId} is not installed.`));
		}
		const loaded = yield* readArkpackFx({
			bytes: new Uint8Array(record.bytes),
			filename: record.descriptor.filename,
			importedAtMs: record.descriptor.importedAtMs,
			source: "imported",
		});
		if (loaded.descriptor.contentHash !== packageId) {
			return yield* Effect.fail(
				new Error(`Arkpack ${packageId} failed its content hash check.`),
			);
		}
		return loaded;
	}).pipe(Effect.ensuring(Effect.sync(() => providedStorage === undefined && storage.close())));
});
