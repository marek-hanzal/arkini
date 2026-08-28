import { FileSystem } from "effect";
import { Effect } from "effect";

import { verifyArkpackProvenanceFx } from "./verifyArkpackProvenanceFx";

export namespace verifyArkpackFileFx {
	export interface Props {
		readonly arkpackPath: string;
	}
}

/** Offline-classifies the optional proof embedded in one Arkpack file. */
export const verifyArkpackFileFx = Effect.fn("verifyArkpackFileFx")(function* ({
	arkpackPath,
}: verifyArkpackFileFx.Props) {
	const fileSystem = yield* FileSystem.FileSystem;
	const bytes = yield* fileSystem.readFile(arkpackPath);
	return yield* verifyArkpackProvenanceFx({
		bytes,
	});
});
