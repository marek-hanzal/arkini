import { FileSystem, Path } from "effect";
import { Effect } from "effect";

import { createFilesystemWriteFx } from "~/engine/filesystem/createFilesystemWriteFx";
import { ArkpackSigningError } from "~/engine/pack/error/ArkpackSigningError";
import { decodeArkpackEnvelopeFx } from "./decodeArkpackEnvelopeFx";
import { encodeArkpackEnvelopeFx } from "./encodeArkpackEnvelopeFx";
import { signArkpackFx } from "./signArkpackFx";
import { verifyArkpackProvenanceFx } from "./verifyArkpackProvenanceFx";

export namespace signArkpackFileFx {
	export interface Props {
		readonly arkpackPath: string;
	}
}

/** Keyless-signs one inner payload and atomically embeds its verified proof. */
export const signArkpackFileFx = Effect.fn("signArkpackFileFx")(function* ({
	arkpackPath,
}: signArkpackFileFx.Props) {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const filesystemWrite = yield* createFilesystemWriteFx();
	const lock = path.join(path.dirname(arkpackPath), `.${path.basename(arkpackPath)}.lock`);
	return yield* filesystemWrite.withLockFx(
		lock,
		Effect.gen(function* () {
			const bytes = yield* fileSystem.readFile(arkpackPath);
			const { payload } = yield* decodeArkpackEnvelopeFx(bytes);
			const signature = yield* signArkpackFx({
				bytes: payload,
			});
			const signedBytes = yield* encodeArkpackEnvelopeFx({
				payload,
				proof: new TextEncoder().encode(JSON.stringify(signature)),
			});
			const provenance = yield* verifyArkpackProvenanceFx({
				bytes: signedBytes,
			});
			if (provenance.type !== "official") {
				return yield* Effect.fail(
					new ArkpackSigningError({
						reason: "post-sign-verification",
						actualProvenance: provenance,
						message:
							"Release signature did not prove the configured workflow identity.",
					}),
				);
			}
			yield* filesystemWrite.replaceFileFx({
				lock,
				target: arkpackPath,
				bytes: signedBytes,
			});
			return signedBytes;
		}),
	);
});
