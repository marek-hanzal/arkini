import { Effect } from "effect";

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

/** Decodes, schema-validates and semantically validates one in-memory Arkpack binary. */
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
	const payload = yield* decodeFx(envelope.payload);
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
