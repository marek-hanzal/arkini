import { FileSystem } from "effect";
import { Effect } from "effect";

import { readArkpackSignaturePathFx } from "./readArkpackSignaturePathFx";

/** Reads an optional detached signature without hiding malformed content as unsigned. */
export const readArkpackSignatureFx = Effect.fn("readArkpackSignatureFx")(function* (
	arkpackPath: string,
) {
	const fileSystem = yield* FileSystem.FileSystem;
	const signaturePath = yield* readArkpackSignaturePathFx(arkpackPath);
	if (!(yield* fileSystem.exists(signaturePath))) return undefined;
	return (yield* fileSystem.readFileString(signaturePath)).trim();
});
