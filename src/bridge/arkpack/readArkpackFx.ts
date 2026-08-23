import { Effect } from "effect";

import { ArkpackLimits } from "../../../shared/ArkpackLimits";
import { validateArkpackPayloadFx } from "~/bridge/arkpack/validateArkpackPayloadFx";
import { decodeFx } from "~/engine/pack/fx/decodeFx";
import { verifyArkpackTrustFx } from "~/engine/pack/fx/verifyArkpackTrustFx";
import type { ArkpackTrustedKeysSchema } from "~/engine/pack/schema/ArkpackTrustedKeysSchema";
import { GameValidationError } from "~/engine/validation/error/GameValidationError";
import { DiagnosticSeverityEnumSchema } from "~/engine/validation/schema/DiagnosticSeverityEnumSchema";

export namespace readArkpackFx {
	export interface Props {
		bytes: Uint8Array;
		filename?: string;
		packageId?: string;
		signature: {
			readonly metadata?: unknown;
			readonly trustedKeys: ArkpackTrustedKeysSchema.Type;
		};
		source: "bundled" | "user";
		overridesBundled?: boolean;
	}
}

const decompressArkpackFx = Effect.fn("decompressArkpackFx")((bytes: Uint8Array) =>
	Effect.tryPromise({
		try: async () => {
			if (bytes.byteLength > ArkpackLimits.maxCompressedBytes) {
				throw new Error(
					`Arkpack exceeds the ${ArkpackLimits.maxCompressedBytes} byte compressed limit.`,
				);
			}
			const reader = new Blob([
				bytes.slice().buffer,
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
	signature,
	source,
	overridesBundled = false,
}: readArkpackFx.Props) {
	if (bytes.byteLength > ArkpackLimits.maxCompressedBytes) {
		return yield* Effect.fail(
			new Error(
				`Arkpack exceeds the ${ArkpackLimits.maxCompressedBytes} byte compressed limit.`,
			),
		);
	}
	const verification = yield* verifyArkpackTrustFx({
		bytes,
		signature: signature.metadata,
		trustedKeys: signature.trustedKeys,
	});
	const contentHash = verification.contentHash;
	const payload = yield* decodeFx(yield* decompressArkpackFx(bytes));
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
	if (packageId !== undefined && packageId !== payload.packageId) {
		return yield* Effect.fail(
			new Error(
				`Arkpack filename declares package ${packageId}, but its signed payload declares ${payload.packageId}.`,
			),
		);
	}
	const gameId = payload.config.meta.id;

	return {
		descriptor: {
			packageId: payload.packageId,
			contentHash,
			gameId,
			title: payload.config.meta.title,
			game: payload.config.version,
			trust: verification.trust,
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
