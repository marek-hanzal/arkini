import { Effect } from "effect";

import { DiagnosticCodeEnumSchema } from "~/engine/validation/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/engine/validation/schema/DiagnosticSeverityEnumSchema";

import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { validateGameConfigFx } from "~/engine/validation/fx/validateGameConfigFx";
import type { DiagnosticPathSchema } from "~/engine/validation/schema/DiagnosticPathSchema";
import type { GameCompilationResultSchema } from "../schema/GameCompilationResultSchema";
import type { GameSourceFileSchema } from "~/engine/source/schema/GameSourceFileSchema";
import type { GameSourceProvenanceSchema } from "~/engine/source/schema/GameSourceProvenanceSchema";
import { assembleGameSourcesFx } from "./assembleGameSourcesFx";
import type { GameDiagnosticsSchema } from "~/engine/validation/schema/GameDiagnosticsSchema";

const readSourcePath = (
	path: DiagnosticPathSchema.Type,
	provenance: GameSourceProvenanceSchema.Type,
) => {
	const [root, key] = path;
	if (root === "items" && typeof key === "string") {
		return provenance.items[key];
	}
	if (root === "categories" && typeof key === "string") {
		return provenance.categories[key];
	}
	if (root === "meta") {
		return provenance.meta;
	}
	if (root === "resources") {
		return provenance.resources;
	}
	if (root === "start") {
		return provenance.start;
	}
	if (root === "version") {
		return provenance.version;
	}
	if (root === "$schema") {
		return provenance.schema?.path;
	}

	return undefined;
};

/**
 * Owns the only source-fragment to completed-game transition used by tests,
 * validation, and binary packing.
 */
export const compileGameSourcesFx = Effect.fn("compileGameSourcesFx")(function* (
	sources: ReadonlyArray<GameSourceFileSchema.Type>,
) {
	const assembly = yield* assembleGameSourcesFx(sources);
	const parsed = GameConfigSchema.safeParse(assembly.value);
	const diagnostics: GameDiagnosticsSchema.Type = [
		...assembly.diagnostics,
	];

	if (!parsed.success) {
		for (const issue of parsed.error.issues) {
			const path = issue.path.map((segment) =>
				typeof segment === "string" || typeof segment === "number"
					? segment
					: String(segment),
			) satisfies DiagnosticPathSchema.Type;
			diagnostics.push({
				code: DiagnosticCodeEnumSchema.enum.ConfigSchema,
				severity: DiagnosticSeverityEnumSchema.enum.Error,
				path,
				source: readSourcePath(path, assembly.provenance),
				message: issue.message,
				issueCode: issue.code,
			});
		}

		return {
			diagnostics,
			provenance: assembly.provenance,
		} satisfies GameCompilationResultSchema.Type;
	}

	diagnostics.push(
		...(yield* validateGameConfigFx({
			config: parsed.data,
			provenance: assembly.provenance,
		})),
	);

	return {
		config: parsed.data,
		diagnostics,
		provenance: assembly.provenance,
	} satisfies GameCompilationResultSchema.Type;
});
