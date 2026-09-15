import { open } from "node:fs/promises";
import { Effect, Path } from "effect";
import { sign } from "sigstore";

import { ArkpackLimits } from "~shared/ArkpackLimits";
import { ArkpackSigningError } from "~/arkpack-artifact/error/ArkpackSigningError";
import { createFilesystemWriteFx } from "~/filesystem-write/fx/createFilesystemWriteFx";
import { readArkpackFileLayoutFx } from "./readArkpackFileLayoutFx";
import { verifyArkpackFileProvenanceFx } from "./verifyArkpackFileProvenanceFx";

const createArkpackProofFx = Effect.fn("signArkpackFileFx.createArkpackProofFx")(
	(contentHash: string) =>
		Effect.tryPromise({
			try: async () => {
				const signature = await sign(Buffer.from(contentHash, "utf8"));
				const proof = new TextEncoder().encode(JSON.stringify(signature));
				if (proof.byteLength > ArkpackLimits.maxProofBytes)
					throw new Error(
						`Arkpack proof exceeds the ${ArkpackLimits.maxProofBytes} byte limit.`,
					);
				return proof;
			},
			catch: (cause) =>
				new ArkpackSigningError({
					reason: "release-signing",
					message: "GitHub release identity could not keyless-sign the Arkpack.",
					cause,
				}),
		}),
);

const writeProofFx = Effect.fn("signArkpackFileFx.writeProofFx")(
	(arkpackPath: string, payloadEnd: number, proof: Uint8Array) =>
		Effect.tryPromise({
			try: async () => {
				const file = await open(arkpackPath, "r+");
				try {
					await file.truncate(payloadEnd);
					let offset = 0;
					while (offset < proof.byteLength) {
						const { bytesWritten } = await file.write(
							proof,
							offset,
							proof.byteLength - offset,
							payloadEnd + offset,
						);
						if (bytesWritten === 0)
							throw new Error("Arkpack proof write made no progress.");
						offset += bytesWritten;
					}
				} finally {
					await file.close();
				}
			},
			catch: (cause) => cause,
		}),
);

export namespace signArkpackFileFx {
	export interface Props {
		readonly arkpackPath: string;
	}
}

/** Signs one streamed payload identity and appends its small release proof. */
export const signArkpackFileFx = Effect.fn("signArkpackFileFx")(function* ({
	arkpackPath,
}: signArkpackFileFx.Props) {
	const path = yield* Path.Path;
	const filesystemWrite = yield* createFilesystemWriteFx();
	const lock = path.join(path.dirname(arkpackPath), `.${path.basename(arkpackPath)}.lock`);
	return yield* filesystemWrite.withLockFx(
		lock,
		Effect.gen(function* () {
			const layout = yield* readArkpackFileLayoutFx(arkpackPath);
			const proof = yield* createArkpackProofFx(layout.contentHash);
			const provenance = yield* verifyArkpackFileProvenanceFx({
				...layout,
				proof,
			});
			if (provenance.type !== "official")
				return yield* Effect.fail(
					new ArkpackSigningError({
						reason: "post-sign-verification",
						actualProvenance: provenance,
						message:
							"Release signature did not prove the configured workflow identity.",
					}),
				);
			const payloadEnd = layout.payloadOffset + layout.payloadLength;
			yield* writeProofFx(arkpackPath, payloadEnd, proof);
			return payloadEnd + proof.byteLength;
		}),
	);
});
