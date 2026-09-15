import { Effect } from "effect";
import { z } from "zod";

import { ArkpackDecodeError } from "~/arkpack-artifact/error/ArkpackDecodeError";
import { ManifestSchema } from "~/arkpack-artifact/schema/ManifestSchema";
import { Magic } from "~/arkpack-artifact/constant/Magic";
import { admitArkiniVersionFx } from "~/application-version/fx/admitArkiniVersionFx";
import { ArkpackLimits } from "~shared/ArkpackLimits";
import { ArkiniVersionSchema } from "~/application-version/schema/ArkiniVersionSchema";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { ResourceSchema } from "~/game-config-resource/schema/ResourceSchema";
import { VersionSchema as GameVersionSchema } from "~/game-version/schema/VersionSchema";

const TestArkpackPayloadSchema = z
	.object({
		version: GameVersionSchema,
		arkini: ArkiniVersionSchema,
		config: GameConfigSchema,
		resources: ResourceSchema.array(),
	})
	.strict();

export type TestArkpackPayload = z.infer<typeof TestArkpackPayloadSchema>;

export const encodeTestArkpackPayloadFx = Effect.fn("encodeTestArkpackPayloadFx")(
	(payload: TestArkpackPayload) =>
		Effect.sync(() => {
			const { version, arkini, config, resources } = TestArkpackPayloadSchema.parse(payload);
			const encoder = new TextEncoder();
			const configBytes = encoder.encode(JSON.stringify(config));
			const manifestBytes = encoder.encode(
				JSON.stringify({
					version,
					arkini,
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

export const decodeTestArkpackPayloadFx = Effect.fn("decodeTestArkpackPayloadFx")(function* (
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
			return TestArkpackPayloadSchema.parse({
				version: manifest.version,
				arkini: manifest.arkini,
				config,
				resources,
			});
		},
		catch: (cause) =>
			new ArkpackDecodeError({
				message: cause instanceof Error ? cause.message : "Invalid Arkpack payload.",
				cause,
			}),
	});
	yield* admitArkiniVersionFx("Arkpack", payload.arkini);
	return payload;
});

export const encodeTestArkpackEnvelopeFx = Effect.fn("encodeTestArkpackEnvelopeFx")(
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

export const decodeTestArkpackEnvelopeFx = Effect.fn("decodeTestArkpackEnvelopeFx")(
	(bytes: Uint8Array) =>
		Effect.sync(() => {
			if (bytes.byteLength > ArkpackLimits.maxArkpackBytes)
				throw new Error(`Arkpack exceeds the ${ArkpackLimits.maxArkpackBytes} byte limit.`);
			const headerLength = Magic.byteLength + 4;
			if (bytes.byteLength < headerLength)
				throw new Error("Invalid Arkpack: truncated envelope.");
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

export const readTestArkpackContentHashFx = Effect.fn("readTestArkpackContentHashFx")(
	(bytes: Uint8Array) =>
		decodeTestArkpackEnvelopeFx(bytes).pipe(
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
