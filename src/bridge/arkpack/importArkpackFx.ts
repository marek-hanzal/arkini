import { Effect } from "effect";

import type { ArkpackStorage } from "~/bridge/arkpack/ArkpackStorage";
import { ArkiniPublicKey } from "~/bridge/arkpack/ArkiniPublicKey";
import { createArkpackStorageFx } from "~/bridge/arkpack/createArkpackStorageFx";
import { readArkpackFx } from "~/bridge/arkpack/readArkpackFx";

export namespace importArkpackFx {
	export interface Props {
		bytes: Uint8Array;
		filename: string;
		packageId?: string;
		signature?: unknown;
		storage?: ArkpackStorage;
	}
}

/** Validates and atomically persists one local arkpack descriptor and exact binary. */
export const importArkpackFx = Effect.fn("importArkpackFx")(function* ({
	bytes,
	filename,
	packageId,
	signature,
	storage: providedStorage,
}: importArkpackFx.Props) {
	const storage = providedStorage ?? (yield* createArkpackStorageFx());
	return yield* Effect.gen(function* () {
		const loaded = yield* readArkpackFx({
			bytes,
			filename,
			packageId,
			signature: {
				metadata: signature,
				publicKey: ArkiniPublicKey,
			},
			source: "user",
		});
		if (loaded.descriptor.trust.type === "invalid") {
			return yield* Effect.fail(
				new Error("The Arkpack signature does not match this build."),
			);
		}
		yield* storage.writeFx(loaded.descriptor.packageId, bytes.slice().buffer, signature);
		return loaded.descriptor;
	});
});
