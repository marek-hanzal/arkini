import { FileSystem } from "effect";
import { Effect } from "effect";

import { readArkpackSignaturePathFx } from "./readArkpackSignaturePathFx";

/** Reads an optional detached Sigstore bundle as untrusted source text. */
export const readArkpackSignatureFx = Effect.fn("readArkpackSignatureFx")(function* (
	arkpackPath: string,
) {
	const fileSystem = yield* FileSystem.FileSystem;
	const signaturePath = yield* readArkpackSignaturePathFx(arkpackPath);
	if (!(yield* fileSystem.exists(signaturePath))) return undefined;
	return (yield* fileSystem.readFileString(signaturePath)).trim();
});
