import { Effect } from "effect";
import { z } from "zod";

import { SerapackDecodeError } from "~/serapack-artifact/error/SerapackDecodeError";
import { ManifestSchema } from "~/serapack-artifact/schema/ManifestSchema";
import { Magic } from "~/serapack-artifact/constant/Magic";
import { admitSerakkiVersionFx } from "~/application-version/fx/admitSerakkiVersionFx";
import { SerapackLimits } from "~shared/SerapackLimits";
import { SerakkiVersionSchema } from "~/application-version/schema/SerakkiVersionSchema";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { ResourceSchema } from "~/game-config-resource/schema/ResourceSchema";
import { VersionSchema as GameVersionSchema } from "~/game-version/schema/VersionSchema";

const TestSerapackPayloadSchema = z
	.object({
		version: GameVersionSchema,
		serakki: SerakkiVersionSchema,
		config: GameConfigSchema,
		resources: ResourceSchema.array(),
	})
	.strict();

export type TestSerapackPayload = z.infer<typeof TestSerapackPayloadSchema>;

export const encodeTestSerapackPayloadFx = Effect.fn("encodeTestSerapackPayloadFx")(
	(payload: TestSerapackPayload) =>
		Effect.sync(() => {
			const { version, serakki, config, resources } =
				TestSerapackPayloadSchema.parse(payload);
			const encoder = new TextEncoder();
			const configBytes = encoder.encode(JSON.stringify(config));
			const manifestBytes = encoder.encode(
				JSON.stringify({
					version,
					serakki,
					length: configBytes.byteLength,
					resources: resources.map((resource) => ({
						id: resource.id,
						type: resource.type,
						length: resource.bytes.byteLength,
					})),
				}),
			);
			const output = new Uint8Array(
				4 +
					manifestBytes.byteLength +
					configBytes.byteLength +
					resources.reduce((length, resource) => length + resource.bytes.byteLength, 0),
			);
			new DataView(output.buffer, output.byteOffset, output.byteLength).setUint32(
				0,
				manifestBytes.byteLength,
				true,
			);
			let offset = 4;
			output.set(manifestBytes, offset);
			offset += manifestBytes.byteLength;
			output.set(configBytes, offset);
			offset += configBytes.byteLength;
			for (const resource of resources) {
				output.set(resource.bytes, offset);
				offset += resource.bytes.byteLength;
			}
			return output;
		}),
);

export const decodeTestSerapackPayloadFx = Effect.fn("decodeTestSerapackPayloadFx")(function* (
	bytes: Uint8Array,
) {
	const payload = yield* Effect.try({
		try: () => {
			const decoder = new TextDecoder("utf-8", {
				fatal: true,
			});
			const manifestLength = new DataView(
				bytes.buffer,
				bytes.byteOffset,
				bytes.byteLength,
			).getUint32(0, true);
			const manifestEnd = 4 + manifestLength;
			const manifest = ManifestSchema.parse(
				JSON.parse(decoder.decode(bytes.slice(4, manifestEnd))),
			);
			const configEnd = manifestEnd + manifest.length;
			const config = JSON.parse(decoder.decode(bytes.slice(manifestEnd, configEnd)));
			let offset = configEnd;
			const resources = manifest.resources.map((resource) => {
				const end = offset + resource.length;
				const resourceBytes = Uint8Array.from(bytes.slice(offset, end));
				offset = end;
				return {
					id: resource.id,
					type: resource.type,
					bytes: resourceBytes,
				};
			});
			return TestSerapackPayloadSchema.parse({
				version: manifest.version,
				serakki: manifest.serakki,
				config,
				resources,
			});
		},
		catch: (cause) =>
			new SerapackDecodeError({
				message: cause instanceof Error ? cause.message : "Invalid Serapack payload.",
				cause,
			}),
	});
	yield* admitSerakkiVersionFx("Serapack", payload.serakki);
	return payload;
});

export const encodeTestSerapackEnvelopeFx = Effect.fn("encodeTestSerapackEnvelopeFx")(
	({ payload, proof = new Uint8Array() }: { payload: Uint8Array; proof?: Uint8Array }) =>
		Effect.sync(() => {
			const headerLength = Magic.byteLength + 4;
			const output = new Uint8Array(headerLength + payload.byteLength + proof.byteLength);
			output.set(Magic, 0);
			new DataView(output.buffer, output.byteOffset, output.byteLength).setUint32(
				Magic.byteLength,
				payload.byteLength,
				true,
			);
			output.set(payload, headerLength);
			output.set(proof, headerLength + payload.byteLength);
			return output;
		}),
);

export const decodeTestSerapackEnvelopeFx = Effect.fn("decodeTestSerapackEnvelopeFx")(
	(bytes: Uint8Array) =>
		Effect.sync(() => {
			if (bytes.byteLength > SerapackLimits.maxSerapackBytes)
				throw new Error(
					`Serapack exceeds the ${SerapackLimits.maxSerapackBytes} byte limit.`,
				);
			const headerLength = Magic.byteLength + 4;
			if (bytes.byteLength < headerLength)
				throw new Error("Invalid Serapack: truncated envelope.");
			const payloadLength = new DataView(
				bytes.buffer,
				bytes.byteOffset,
				bytes.byteLength,
			).getUint32(Magic.byteLength, true);
			const payloadEnd = headerLength + payloadLength;
			return {
				payload: bytes.slice(headerLength, payloadEnd),
				...(payloadEnd === bytes.byteLength
					? {}
					: {
							proof: bytes.slice(payloadEnd),
						}),
			};
		}),
);

export const readTestSerapackContentHashFx = Effect.fn("readTestSerapackContentHashFx")(
	(bytes: Uint8Array) =>
		decodeTestSerapackEnvelopeFx(bytes).pipe(
			Effect.flatMap(({ payload }) =>
				Effect.promise(async () =>
					Array.from(
						new Uint8Array(
							await crypto.subtle.digest("SHA-256", payload.slice().buffer),
						),
						(byte) => byte.toString(16).padStart(2, "0"),
					).join(""),
				),
			),
		),
);
