import { Effect } from "effect";

import { ArkpackLimits } from "~/bridge/arkpack/ArkpackLimits";
import { validateArkpackPayloadFx } from "~/bridge/arkpack/validateArkpackPayloadFx";
import { EditorProjectRepository } from "~/bridge/editor/EditorProjectRepository";
import { EditorProjectError } from "~/engine/editor/error/EditorProjectError";
import { encodeFx } from "~/engine/pack/fx/encodeFx";
import { readArkpackContentHashFx } from "~/engine/pack/fx/readArkpackContentHashFx";
import { GameValidationError } from "~/engine/validation/error/GameValidationError";
import { DiagnosticSeverityEnumSchema } from "~/engine/validation/schema/DiagnosticSeverityEnumSchema";
import type { GameDiagnosticsSchema } from "~/engine/validation/schema/GameDiagnosticsSchema";

export namespace buildEditorProjectFx {
	export interface Success {
		readonly bytes: Uint8Array;
		readonly contentHash: string;
		readonly diagnostics: GameDiagnosticsSchema.Type;
		readonly filename: string;
		readonly revision: number;
	}
}

const compressArkpackFx = Effect.fn("compressArkpackFx")((bytes: Uint8Array) =>
	Effect.tryPromise({
		try: async () => {
			if (bytes.byteLength > ArkpackLimits.maxDecodedBytes) {
				throw new Error(
					`Arkpack exceeds the ${ArkpackLimits.maxDecodedBytes} byte decoded limit.`,
				);
			}
			const compressed = new Uint8Array(
				await new Response(
					new Blob([
						bytes.slice().buffer,
					])
						.stream()
						.pipeThrough(new CompressionStream("gzip")),
				).arrayBuffer(),
			);
			if (compressed.byteLength > ArkpackLimits.maxCompressedBytes) {
				throw new Error(
					`Arkpack exceeds the ${ArkpackLimits.maxCompressedBytes} byte compressed limit.`,
				);
			}
			return compressed;
		},
		catch: (cause) => cause,
	}),
);

/** Reads one exact canonical snapshot, fully validates it, and builds immutable Arkpack bytes. */
export const buildEditorProjectFx = Effect.fn("buildEditorProjectFx")(function* (
	projectId: string,
) {
	const repository = yield* EditorProjectRepository;
	const project = yield* repository.readProjectFx(projectId);
	if (project === null) {
		return yield* Effect.fail(
			new EditorProjectError({
				reason: "project-not-found",
				message: `Editor project ${projectId} does not exist.`,
			}),
		);
	}
	const payload = {
		config: project.config,
		resources: [
			...project.resources,
		],
	};
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
	const bytes = yield* compressArkpackFx(yield* encodeFx(payload));
	const contentHash = yield* readArkpackContentHashFx(bytes);
	return {
		bytes,
		contentHash,
		diagnostics,
		filename: `${project.config.meta.id}.arkpack`,
		revision: project.revision,
	} satisfies buildEditorProjectFx.Success;
});
