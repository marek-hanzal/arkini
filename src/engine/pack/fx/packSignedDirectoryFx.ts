import { Effect } from "effect";

import type { ArkpackTrustedKeysSchema } from "~/engine/pack/schema/ArkpackTrustedKeysSchema";
import { packDirectoryFx } from "./packDirectoryFx";
import { signArkpackFileFx } from "./signArkpackFileFx";
import { verifyArkpackFileFx } from "./verifyArkpackFileFx";

export namespace packSignedDirectoryFx {
	export interface Props {
		readonly input: string;
		readonly keyId: string;
		readonly metadata: {
			readonly output: string;
			readonly packageId: string;
		};
		readonly output?: string;
		readonly privateKey: string;
		readonly trustedKeys: ArkpackTrustedKeysSchema.Type;
	}
}

/** Packs, signs, and post-verifies one official Arkpack without weakening generic packing. */
export const packSignedDirectoryFx = Effect.fn("packSignedDirectoryFx")(function* ({
	input,
	keyId,
	metadata,
	output,
	privateKey,
	trustedKeys,
}: packSignedDirectoryFx.Props) {
	if (!trustedKeys.keys.some((key) => key.keyId === keyId)) {
		return yield* Effect.fail(
			new Error(`Official Arkpack keyId ${keyId} is absent from the trusted registry.`),
		);
	}
	const packed = yield* packDirectoryFx({
		input,
		metadata,
		...(output === undefined
			? {}
			: {
					output,
				}),
	});
	const signed = yield* signArkpackFileFx({
		arkpackPath: packed.output,
		keyId,
		privateKey,
	});
	const verification = yield* verifyArkpackFileFx({
		arkpackPath: packed.output,
		trustedKeys,
	});
	if (verification.trust.type !== "official" || verification.trust.keyId !== keyId) {
		return yield* Effect.fail(
			new Error("Official Arkpack post-sign verification did not establish trust."),
		);
	}
	return {
		packed,
		signature: signed.signature,
		signaturePath: signed.signaturePath,
		trust: verification.trust,
	} as const;
});
