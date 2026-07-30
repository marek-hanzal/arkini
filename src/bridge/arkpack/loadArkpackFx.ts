import { Effect } from "effect";

import { BuiltInArkpacks } from "~/bridge/arkpack/BuiltInArkpacks";
import type { ArkpackStorage } from "~/bridge/arkpack/ArkpackStorage";
import { ArkiniTrustedKeys } from "~/bridge/arkpack/ArkiniTrustedKeys";
import { createArkpackStorageFx } from "~/bridge/arkpack/createArkpackStorageFx";
import { fetchBuiltInArkpackBytesFx } from "~/bridge/arkpack/fetchBuiltInArkpackBytesFx";
import { fetchBuiltInArkpackSignatureFx } from "~/bridge/arkpack/fetchBuiltInArkpackSignatureFx";
import { hasExpectedArkpackTrustFx } from "~/bridge/arkpack/hasExpectedArkpackTrustFx";
import { readArkpackFx } from "~/bridge/arkpack/readArkpackFx";

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
	const builtIn = BuiltInArkpacks.find((arkpack) => arkpack.packageId === packageId);
	if (builtIn !== undefined) {
		const expected = builtIn.descriptor;
		const loaded = yield* readArkpackFx({
			bytes: yield* fetchBuiltInArkpackBytesFx({
				arkpack: builtIn,
			}),
			packageId,
			signature: {
				...(expected.trust.type === "official"
					? {
							expectedKeyId: expected.trust.keyId,
						}
					: {}),
				metadata: yield* fetchBuiltInArkpackSignatureFx({
					arkpack: builtIn,
				}),
				trustedKeys: ArkiniTrustedKeys,
			},
			source: "built-in",
		});
		const trustMatches = yield* hasExpectedArkpackTrustFx({
			actual: loaded.descriptor.trust,
			expected: expected.trust,
		});
		if (
			loaded.descriptor.contentHash !== expected.contentHash ||
			loaded.descriptor.gameId !== expected.gameId ||
			loaded.descriptor.title !== expected.title ||
			loaded.descriptor.game !== expected.game ||
			!trustMatches
		) {
			return yield* Effect.fail(
				new Error(
					`Bundled ${builtIn.packageId} metadata does not match its exact package binary.`,
				),
			);
		}
		return loaded;
	}

	const storage = providedStorage ?? (yield* createArkpackStorageFx());
	return yield* Effect.gen(function* () {
		const record = yield* storage.readFx(packageId);
		if (record === undefined) {
			return yield* Effect.fail(new Error(`Arkpack ${packageId} is not installed.`));
		}
		const loaded = yield* readArkpackFx({
			bytes: new Uint8Array(record.bytes),
			filename: record.descriptor.filename,
			importedAtMs: record.descriptor.importedAtMs,
			signature: {
				trustedKeys: ArkiniTrustedKeys,
			},
			source: "imported",
		});
		if (loaded.descriptor.contentHash !== packageId) {
			return yield* Effect.fail(
				new Error(`Arkpack ${packageId} failed its content hash check.`),
			);
		}
		return loaded;
	});
});
