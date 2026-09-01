import { Effect } from "effect";

import { ArkpackLimits } from "~shared/ArkpackLimits";
import { validateArkpackPayloadFx } from "~/arkpack-admission/fx/validateArkpackPayloadFx";
import { decodeFx } from "~/arkpack-artifact/fx/decodeFx";
import { decodeArkpackEnvelopeFx } from "~/arkpack-artifact/fx/decodeArkpackEnvelopeFx";
import { readArkpackContentHashFx } from "~/arkpack-artifact/fx/readArkpackContentHashFx";
import type { ArkpackProvenanceSchema } from "~/arkpack-artifact/schema/ArkpackProvenanceSchema";
import { GameValidationError } from "~/game-config-diagnostic/error/GameValidationError";
import { DiagnosticSeverityEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticSeverityEnumSchema";

export namespace readArkpackFx {
	export interface Props {
		bytes: Uint8Array;
		filename?: string;
		packageId?: string;
		provenance: ArkpackProvenanceSchema.Type;
		source: "bundled" | "user";
		overridesBundled?: boolean;
	}
}

const decompressArkpackFx = Effect.fn("decompressArkpackFx")((bytes: Uint8Array) =>
	Effect.tryPromise({
		try: async () => {
			if (bytes.byteLength > ArkpackLimits.maxPayloadBytes) {
				throw new Error(
					`Arkpack payload exceeds the ${ArkpackLimits.maxPayloadBytes} byte compressed limit.`,
				);
			}
			const compressed = new Uint8Array(bytes);
			const reader = new Blob([
				compressed.buffer,
			])
				.stream()
				.pipeThrough(new DecompressionStream("gzip"))
				.getReader();
			const chunks: Uint8Array[] = [];
			let length = 0;
			while (true) {
				const next = await reader.read();
				if (next.done) break;
				length += next.value.byteLength;
				if (length > ArkpackLimits.maxDecodedBytes) {
					await reader.cancel();
					throw new Error(
						`Arkpack exceeds the ${ArkpackLimits.maxDecodedBytes} byte decoded limit.`,
					);
				}
				chunks.push(next.value);
			}
			const output = new Uint8Array(length);
			let offset = 0;
			for (const chunk of chunks) {
				output.set(chunk, offset);
				offset += chunk.byteLength;
			}
			return output;
		},
		catch: (cause) => cause,
	}),
);

/** Decodes, schema-validates and semantically validates one compressed arkpack binary. */
export const readArkpackFx = Effect.fn("readArkpackFx")(function* ({
	bytes,
	filename,
	packageId,
	provenance,
	source,
	overridesBundled = false,
}: readArkpackFx.Props) {
	const contentHash = yield* readArkpackContentHashFx(bytes);
	const envelope = yield* decodeArkpackEnvelopeFx(bytes);
	const payload = yield* decodeFx(yield* decompressArkpackFx(envelope.payload));
	const diagnostics = yield* validateArkpackPayloadFx(payload);
	const errors = diagnostics.filter(
		({ severity }) => severity === DiagnosticSeverityEnumSchema.enum.Error,
	);
	if (errors.length > 0) {
		return yield* Effect.fail(
			new GameValidationError({
				diagnostics: errors,
			}),
		);
	}
	const payloadPackageId = payload.config.meta.id;
	if (packageId !== undefined && packageId !== payloadPackageId) {
		return yield* Effect.fail(
			new Error(
				`Arkpack was addressed as package ${packageId}, but its config declares ${payloadPackageId}.`,
			),
		);
	}
	return {
		bytes,
		descriptor: {
			packageId: payloadPackageId,
			contentHash,
			title: payload.config.meta.title,
			version: payload.version,
			arkini: payload.arkini,
			provenance,
			source,
			overridesBundled,
			...(filename === undefined
				? {}
				: {
						filename,
					}),
		},
		payload,
	};
});
