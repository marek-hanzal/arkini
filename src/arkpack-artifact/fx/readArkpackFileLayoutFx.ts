import { createHash } from "node:crypto";
import { open, type FileHandle } from "node:fs/promises";
import { Effect } from "effect";

import { ArkpackLimits } from "~shared/ArkpackLimits";
import { Magic } from "~/arkpack-artifact/constant/Magic";
import { ManifestSchema } from "~/arkpack-artifact/schema/ManifestSchema";
import type { ArkpackFileLayout } from "~/arkpack-artifact/type/ArkpackFileLayout";

const readExactFx = Effect.fn("readArkpackFileLayoutFx.readExactFx")(
	(file: Awaited<ReturnType<typeof open>>, offset: number, length: number) =>
		Effect.tryPromise({
			try: async () => {
				const bytes = Buffer.allocUnsafe(length);
				const { bytesRead } = await file.read(bytes, 0, length, offset);
				if (bytesRead !== length) throw new Error("Invalid Arkpack: truncated file.");
				return new Uint8Array(bytes);
			},
			catch: (cause) => cause,
		}),
);

const hashRangeFx = Effect.fn("readArkpackFileLayoutFx.hashRangeFx")(
	(file: FileHandle, start: number, length: number) =>
		Effect.tryPromise({
			try: async () => {
				const hash = createHash("sha256");
				for await (const chunk of file.createReadStream({
					autoClose: false,
					start,
					end: start + length - 1,
				}))
					hash.update(chunk as Buffer);
				return hash.digest("hex");
			},
			catch: (cause) => cause,
		}),
);

/** Reads only Arkpack headers/proof and hashes its payload incrementally. */
export const readArkpackFileLayoutFx = Effect.fn("readArkpackFileLayoutFx")(function* (
	arkpackPath: string,
) {
	return yield* Effect.acquireUseRelease(
		Effect.tryPromise({
			try: () => open(arkpackPath, "r"),
			catch: (cause) => cause,
		}),
		(file) =>
			Effect.gen(function* () {
				const stat = yield* Effect.tryPromise({
					try: () => file.stat(),
					catch: (cause) => cause,
				});
				const size = Number(stat.size);
				if (size > ArkpackLimits.maxArkpackBytes)
					return yield* Effect.fail(
						new Error(
							`Arkpack exceeds the ${ArkpackLimits.maxArkpackBytes} byte limit.`,
						),
					);
				const envelopeHeaderLength = Magic.byteLength + 4;
				if (size < envelopeHeaderLength)
					return yield* Effect.fail(new Error("Invalid Arkpack: truncated envelope."));
				const envelopeHeader = yield* readExactFx(file, 0, envelopeHeaderLength);
				if (!Magic.every((byte, index) => envelopeHeader[index] === byte))
					return yield* Effect.fail(
						new Error("Invalid Arkpack: envelope magic mismatch."),
					);
				const payloadLength = new DataView(
					envelopeHeader.buffer,
					envelopeHeader.byteOffset,
					envelopeHeader.byteLength,
				).getUint32(Magic.byteLength, true);
				if (payloadLength === 0 || payloadLength > ArkpackLimits.maxPayloadBytes)
					return yield* Effect.fail(
						new Error(`Invalid Arkpack payload length ${payloadLength}.`),
					);
				const payloadOffset = envelopeHeaderLength;
				const payloadEnd = payloadOffset + payloadLength;
				if (payloadEnd > size)
					return yield* Effect.fail(new Error("Invalid Arkpack: truncated payload."));
				const proofLength = size - payloadEnd;
				if (proofLength > ArkpackLimits.maxProofBytes)
					return yield* Effect.fail(
						new Error(
							`Arkpack proof exceeds the ${ArkpackLimits.maxProofBytes} byte limit.`,
						),
					);
				if (payloadLength < 4)
					return yield* Effect.fail(new Error("Invalid pack: truncated header."));
				const manifestLengthBytes = yield* readExactFx(file, payloadOffset, 4);
				const manifestLength = new DataView(
					manifestLengthBytes.buffer,
					manifestLengthBytes.byteOffset,
					manifestLengthBytes.byteLength,
				).getUint32(0, true);
				if (manifestLength === 0 || manifestLength > ArkpackLimits.maxManifestBytes)
					return yield* Effect.fail(
						new Error(`Invalid pack manifest length ${manifestLength}.`),
					);
				const manifestOffset = payloadOffset + 4;
				const manifestEnd = manifestOffset + manifestLength;
				if (manifestEnd > payloadEnd)
					return yield* Effect.fail(new Error("Invalid pack: truncated manifest."));
				const manifestBytes = yield* readExactFx(file, manifestOffset, manifestLength);
				const manifest = yield* Effect.try({
					try: () =>
						ManifestSchema.parse(
							JSON.parse(
								new TextDecoder("utf-8", {
									fatal: true,
								}).decode(manifestBytes),
							),
						),
					catch: (cause) => cause,
				});
				if (manifest.length > ArkpackLimits.maxConfigBytes)
					return yield* Effect.fail(
						new Error(`Invalid pack config length ${manifest.length}.`),
					);
				const configOffset = manifestEnd;
				const configEnd = configOffset + manifest.length;
				if (configEnd > payloadEnd)
					return yield* Effect.fail(new Error("Invalid pack: truncated config."));
				let resourceOffset = configEnd;
				const resourceIds = new Set<string>();
				const resources = [];
				for (const resource of manifest.resources) {
					if (resourceIds.has(resource.id))
						return yield* Effect.fail(
							new Error(`Invalid pack: duplicate resource ${resource.id}.`),
						);
					resourceIds.add(resource.id);
					const offset = resourceOffset;
					resourceOffset += resource.length;
					if (resourceOffset > payloadEnd)
						return yield* Effect.fail(
							new Error(`Invalid pack: truncated resource ${resource.id}.`),
						);
					resources.push({
						...resource,
						offset,
					});
				}
				if (resourceOffset !== payloadEnd)
					return yield* Effect.fail(
						new Error(`Invalid pack: trailing ${payloadEnd - resourceOffset} bytes.`),
					);
				return {
					arkpackPath,
					contentHash: yield* hashRangeFx(file, payloadOffset, payloadLength),
					configLength: manifest.length,
					configOffset,
					manifest,
					payloadLength,
					payloadOffset,
					...(proofLength === 0
						? {}
						: {
								proof: yield* readExactFx(file, payloadEnd, proofLength),
							}),
					resources,
					size,
				} satisfies ArkpackFileLayout;
			}),
		(file) => Effect.promise(() => file.close()).pipe(Effect.ignore),
	);
});
