import { open } from "node:fs/promises";
import { Effect, Path } from "effect";
import { sign } from "sigstore";

import { SerapackLimits } from "~shared/SerapackLimits";
import { SerapackSigningError } from "~/serapack-artifact/error/SerapackSigningError";
import { createFilesystemWriteFx } from "~/filesystem-write/fx/createFilesystemWriteFx";
import { readSerapackFileLayoutFx } from "./readSerapackFileLayoutFx";
import { verifySerapackFileProvenanceFx } from "./verifySerapackFileProvenanceFx";

const createSerapackProofFx = Effect.fn("signSerapackFileFx.createSerapackProofFx")(
	(contentHash: string) =>
		Effect.tryPromise({
			try: async () => {
				const signature = await sign(Buffer.from(contentHash, "utf8"));
				const proof = new TextEncoder().encode(JSON.stringify(signature));
				if (proof.byteLength > SerapackLimits.maxProofBytes)
					throw new Error(
						`Serapack proof exceeds the ${SerapackLimits.maxProofBytes} byte limit.`,
					);
				return proof;
			},
			catch: (cause) =>
				new SerapackSigningError({
					reason: "release-signing",
					message: "GitHub release identity could not keyless-sign the Serapack.",
					cause,
				}),
		}),
);

const writeProofFx = Effect.fn("signSerapackFileFx.writeProofFx")(
	(serapackPath: string, payloadEnd: number, proof: Uint8Array) =>
		Effect.tryPromise({
			try: async () => {
				const file = await open(serapackPath, "r+");
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
							throw new Error("Serapack proof write made no progress.");
						offset += bytesWritten;
					}
				} finally {
					await file.close();
				}
			},
			catch: (cause) => cause,
		}),
);

export namespace signSerapackFileFx {
	export interface Props {
		readonly serapackPath: string;
	}
}

/** Signs one streamed payload identity and appends its small release proof. */
export const signSerapackFileFx = Effect.fn("signSerapackFileFx")(function* ({
	serapackPath,
}: signSerapackFileFx.Props) {
	const path = yield* Path.Path;
	const filesystemWrite = yield* createFilesystemWriteFx();
	const lock = path.join(path.dirname(serapackPath), `.${path.basename(serapackPath)}.lock`);
	return yield* filesystemWrite.withLockFx(
		lock,
		Effect.gen(function* () {
			const layout = yield* readSerapackFileLayoutFx(serapackPath);
			const proof = yield* createSerapackProofFx(layout.contentHash);
			const provenance = yield* verifySerapackFileProvenanceFx({
				...layout,
				proof,
			});
			if (provenance.type !== "official")
				return yield* Effect.fail(
					new SerapackSigningError({
						reason: "post-sign-verification",
						actualProvenance: provenance,
						message:
							"Release signature did not prove the configured workflow identity.",
					}),
				);
			const payloadEnd = layout.payloadOffset + layout.payloadLength;
			yield* writeProofFx(serapackPath, payloadEnd, proof);
			return payloadEnd + proof.byteLength;
		}),
	);
});
