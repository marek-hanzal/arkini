import { FileSystem } from "@effect/platform";
import { Effect } from "effect";

import { signArkpackFx } from "./signArkpackFx";
import { writeArkpackSignatureFx } from "./writeArkpackSignatureFx";

export namespace signArkpackFileFx {
	export interface Props {
		readonly arkpackPath: string;
		readonly keyId: string;
		readonly privateKey: string;
	}
}

/** Signs one exact Arkpack file and atomically publishes its detached sidecar. */
export const signArkpackFileFx = Effect.fn("signArkpackFileFx")(function* ({
	arkpackPath,
	keyId,
	privateKey,
}: signArkpackFileFx.Props) {
	const fileSystem = yield* FileSystem.FileSystem;
	const bytes = yield* fileSystem.readFile(arkpackPath);
	const signature = yield* signArkpackFx({
		bytes,
		keyId,
		privateKey,
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
