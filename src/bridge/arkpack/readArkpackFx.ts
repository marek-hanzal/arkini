import { Effect } from "effect";

import { ArkpackLimits } from "~/bridge/arkpack/ArkpackLimits";
import { decodeFx } from "~/engine/pack/fx/decodeFx";
import type { GameSourceProvenanceSchema } from "~/engine/source/schema/GameSourceProvenanceSchema";
import { GameValidationError } from "~/engine/validation/error/GameValidationError";
import { validateGameConfigFx } from "~/engine/validation/fx/validateGameConfigFx";
import { validateGameResourcesFx } from "~/engine/validation/rule/validateGameResourcesFx";
import { DiagnosticSeverityEnumSchema } from "~/engine/validation/schema/DiagnosticSeverityEnumSchema";

export namespace readArkpackFx {
	export interface Props {
		bytes: Uint8Array;
		filename?: string;
		importedAtMs?: number;
		packageId?: string;
		source: "built-in" | "imported";
	}
}

const toHex = (bytes: ArrayBuffer) =>
	Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");

const readContentHash = (bytes: Uint8Array) =>
	Effect.tryPromise({
		try: async () => toHex(await crypto.subtle.digest("SHA-256", bytes.slice().buffer)),
		catch: (cause) => cause,
	});

const decompress = (bytes: Uint8Array) =>
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
	});

const createPackProvenance = (
	gameId: string,
	categories: Readonly<Record<string, unknown>>,
	items: Readonly<Record<string, unknown>>,
): GameSourceProvenanceSchema.Type => {
	const source = `arkpack:${gameId}`;
	return {
		meta: source,
		resources: source,
		start: source,
		version: source,
		categories: Object.fromEntries(
			Object.keys(categories).map((id) => [
				id,
				source,
			]),
		),
		items: Object.fromEntries(
			Object.keys(items).map((id) => [
				id,
				source,
			]),
		),
	};
};

/** Decodes, schema-validates and semantically validates one compressed arkpack binary. */
export const readArkpackFx = Effect.fn("readArkpackFx")(function* ({
	bytes,
	filename,
	importedAtMs,
	packageId,
	source,
}: readArkpackFx.Props) {
	if (bytes.byteLength > ArkpackLimits.maxCompressedBytes) {
		return yield* Effect.fail(
			new Error(
				`Arkpack exceeds the ${ArkpackLimits.maxCompressedBytes} byte compressed limit.`,
			),
		);
	}
	const contentHash = yield* readContentHash(bytes);
	const payload = yield* decodeFx(yield* decompress(bytes));
	for (const resource of payload.resources) {
		if (resource.mime !== "image/png") {
			return yield* Effect.fail(
				new Error(
					`Unsupported arkpack resource MIME ${resource.mime}; only image/png is allowed.`,
				),
			);
		}
	}
	const provenance = createPackProvenance(
		payload.config.meta.id,
		payload.config.categories,
		payload.config.items,
	);
	const diagnostics = [
		...(yield* validateGameConfigFx({
			config: payload.config,
			provenance,
		})),
		...(yield* validateGameResourcesFx({
			config: payload.config,
			provenance,
			resources: payload.resources.map((resource) => ({
				id: resource.id,
				mime: "image/png" as const,
				path: `arkpack:${resource.id}`,
			})),
		})),
	];
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

	return {
		descriptor: {
			packageId: packageId ?? contentHash,
			contentHash,
			gameId: payload.config.meta.id,
			title: payload.config.meta.title,
			configVersion: payload.config.version,
			compressedSize: bytes.byteLength,
			source,
			...(filename === undefined
				? {}
				: {
						filename,
					}),
			...(importedAtMs === undefined
				? {}
				: {
						importedAtMs,
					}),
		},
		payload,
	};
});
