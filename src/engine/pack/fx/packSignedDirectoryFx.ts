import { Effect } from "effect";

import { ArkpackSigningError } from "~/engine/pack/error/ArkpackSigningError";
import type { ArkpackTrustedKeysSchema } from "~/engine/pack/schema/ArkpackTrustedKeysSchema";
import type { ArkpackVersionSchema } from "~/engine/version/schema/ArkpackVersionSchema";
import { packDirectoryFx } from "./packDirectoryFx";
import { signArkpackFileFx } from "./signArkpackFileFx";
import { verifyArkpackFileFx } from "./verifyArkpackFileFx";

export namespace packSignedDirectoryFx {
	export interface Props {
		readonly input: string;
		readonly keyId: string;
		readonly packageId: string;
		readonly version: ArkpackVersionSchema.Type;
		readonly output?: string;
		readonly privateKey: string;
		readonly trustedKeys: ArkpackTrustedKeysSchema.Type;
	}
}

/** Packs, signs, and post-verifies one official Arkpack without weakening generic packing. */
export const packSignedDirectoryFx = Effect.fn("packSignedDirectoryFx")(function* ({
	input,
	keyId,
	packageId,
	version,
	output,
	privateKey,
	trustedKeys,
}: packSignedDirectoryFx.Props) {
	if (!trustedKeys.keys.some((key) => key.keyId === keyId)) {
		return yield* Effect.fail(
			new ArkpackSigningError({
				reason: "untrusted-key-id",
				keyId,
				message: `Official Arkpack keyId ${keyId} is absent from the trusted registry.`,
			}),
		);
	}
	const packed = yield* packDirectoryFx({
		input,
		packageId,
		version,
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
			new ArkpackSigningError({
				reason: "post-sign-verification",
				keyId,
				actualTrust: verification.trust,
				message: "Official Arkpack post-sign verification did not establish trust.",
			}),
		);
	}
	return {
		packed,
		signature: signed.signature,
		signaturePath: signed.signaturePath,
		trust: verification.trust,
	} as const;
});
