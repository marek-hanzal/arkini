import { FileSystem } from "effect";
import { Effect } from "effect";

import { ArkpackSigningError } from "~/engine/pack/error/ArkpackSigningError";
import { signArkpackFx } from "./signArkpackFx";
import { verifyArkpackTrustFx } from "./verifyArkpackTrustFx";
import { writeArkpackSignatureFx } from "./writeArkpackSignatureFx";

export namespace signArkpackFileFx {
	export interface Props {
		readonly arkpackPath: string;
	}
}

/** Keyless-signs one exact Arkpack and publishes its bundle after offline verification. */
export const signArkpackFileFx = Effect.fn("signArkpackFileFx")(function* ({
	arkpackPath,
}: signArkpackFileFx.Props) {
	const fileSystem = yield* FileSystem.FileSystem;
	const bytes = yield* fileSystem.readFile(arkpackPath);
	const signature = yield* signArkpackFx({
		bytes,
	});
	const trust = yield* verifyArkpackTrustFx({
		bytes,
		signature,
	});
	if (trust.type !== "trusted") {
		return yield* Effect.fail(
			new ArkpackSigningError({
				reason: "post-sign-verification",
				actualTrust: trust,
				message: "Release signature did not prove the configured workflow identity.",
			}),
		);
	}
	const signaturePath = yield* writeArkpackSignatureFx({
		arkpackPath,
		signature,
	});
	return {
		signature,
		signaturePath,
	} as const;
});
