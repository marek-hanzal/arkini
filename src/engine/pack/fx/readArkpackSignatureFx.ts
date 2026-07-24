import { FileSystem } from "@effect/platform";
import { Effect } from "effect";

import { readArkpackSignaturePathFx } from "./readArkpackSignaturePathFx";

/** Reads optional detached JSON metadata without hiding malformed content as unsigned. */
export const readArkpackSignatureFx = Effect.fn("readArkpackSignatureFx")(function* (
	arkpackPath: string,
) {
	const fileSystem = yield* FileSystem.FileSystem;
	const signaturePath = yield* readArkpackSignaturePathFx(arkpackPath);
	if (!(yield* fileSystem.exists(signaturePath))) return undefined;
	const source = yield* fileSystem.readFileString(signaturePath);
	return yield* Effect.sync(() => {
		try {
			return JSON.parse(source) as unknown;
		} catch {
			return source;
		}
	});
});
