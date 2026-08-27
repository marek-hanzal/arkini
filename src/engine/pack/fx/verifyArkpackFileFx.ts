import { FileSystem } from "effect";
import { Effect } from "effect";

import { readArkpackSignatureFx } from "./readArkpackSignatureFx";
import { verifyArkpackTrustFx } from "./verifyArkpackTrustFx";

export namespace verifyArkpackFileFx {
	export interface Props {
		readonly arkpackPath: string;
	}
}

/** Verifies one file and its optional canonical sidecar without decoding the Arkpack. */
export const verifyArkpackFileFx = Effect.fn("verifyArkpackFileFx")(function* ({
	arkpackPath,
}: verifyArkpackFileFx.Props) {
	const fileSystem = yield* FileSystem.FileSystem;
	const bytes = yield* fileSystem.readFile(arkpackPath);
	const signature = yield* readArkpackSignatureFx(arkpackPath);
	return yield* verifyArkpackTrustFx({
		bytes,
		signature,
	});
});
