import { FileSystem } from "effect";
import { Effect } from "effect";

import { signArkpackFx } from "./signArkpackFx";
import { writeArkpackSignatureFx } from "./writeArkpackSignatureFx";

export namespace signArkpackFileFx {
	export interface Props {
		readonly arkpackPath: string;
		readonly signKey: string;
	}
}

/** Signs one exact Arkpack file and atomically publishes its detached sidecar. */
export const signArkpackFileFx = Effect.fn("signArkpackFileFx")(function* ({
	arkpackPath,
	signKey,
}: signArkpackFileFx.Props) {
	const fileSystem = yield* FileSystem.FileSystem;
	const bytes = yield* fileSystem.readFile(arkpackPath);
	const signature = yield* signArkpackFx({
		bytes,
		signKey,
	});
	const signaturePath = yield* writeArkpackSignatureFx({
		arkpackPath,
		signature,
	});
	return {
		signature,
		signaturePath,
	} as const;
});
