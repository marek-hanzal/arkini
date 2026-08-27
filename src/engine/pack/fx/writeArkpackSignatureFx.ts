import { FileSystem, Path } from "effect";
import { Effect } from "effect";

import { readArkpackSignaturePathFx } from "./readArkpackSignaturePathFx";

export namespace writeArkpackSignatureFx {
	export interface Props {
		readonly arkpackPath: string;
		readonly signature: unknown;
	}
}

/** Atomically writes one detached Sigstore bundle sidecar. */
export const writeArkpackSignatureFx = Effect.fn("writeArkpackSignatureFx")(function* ({
	arkpackPath,
	signature,
}: writeArkpackSignatureFx.Props) {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const signaturePath = yield* readArkpackSignaturePathFx(arkpackPath);
	yield* fileSystem.makeDirectory(path.dirname(signaturePath), {
		recursive: true,
	});
	yield* Effect.scoped(
		Effect.gen(function* () {
			const pending = yield* fileSystem.makeTempFileScoped({
				directory: path.dirname(signaturePath),
				prefix: `${path.basename(signaturePath)}.`,
				suffix: ".pending",
			});
			yield* fileSystem.writeFileString(pending, `${JSON.stringify(signature, null, 2)}\n`);
			yield* fileSystem.rename(pending, signaturePath);
		}),
	);
	return signaturePath;
});
