import { Effect } from "effect";
import { match, P } from "ts-pattern";

import { DiagnosticCodeEnumSchema } from "~/game-config/diagnostic/schema/DiagnosticCodeEnumSchema";
import { DiagnosticProviderEnumSchema } from "~/game-config/diagnostic/schema/DiagnosticProviderEnumSchema";
import { DiagnosticRecordEntityEnumSchema } from "~/game-config/diagnostic/schema/DiagnosticRecordEntityEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/game-config/diagnostic/schema/DiagnosticSeverityEnumSchema";

import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { GameSourceSchema } from "~/game-config/source/schema/GameSourceSchema";
import { validateGameConfigFx } from "~/game-config/validation/fx/validateGameConfigFx";
import type { DiagnosticPathSchema } from "~/game-config/diagnostic/schema/DiagnosticPathSchema";
import type { GameCompilationResultSchema } from "../schema/GameCompilationResultSchema";
import type { GameSourceFileSchema } from "~/game-config/source/schema/GameSourceFileSchema";
import type { GameSourceProvenanceSchema } from "~/game-config/source/schema/GameSourceProvenanceSchema";
import type { GameDiagnosticsSchema } from "~/game-config/diagnostic/schema/GameDiagnosticsSchema";

const resolveSourceReferenceFn = (sourcePath: string, reference: string) => {
	const portableSource = sourcePath.replaceAll("\\", "/");
	const portableReference = reference.replaceAll("\\", "/");
	const absoluteReference =
		portableReference.startsWith("/") || /^[A-Za-z]:\//.test(portableReference);
	const sourceDirectory = portableSource.includes("/")
		? portableSource.slice(0, portableSource.lastIndexOf("/"))
		: ".";
	const unresolved = absoluteReference
		? portableReference
		: `${sourceDirectory}/${portableReference}`;
	const drive = unresolved.match(/^[A-Za-z]:/)?.[0];
	const absolute = drive !== undefined || unresolved.startsWith("/");
	const segments: string[] = [];
	for (const segment of unresolved.replace(/^[A-Za-z]:/, "").split("/")) {
		if (segment === "" || segment === ".") continue;
		if (segment === "..") {
			if (segments.at(-1) !== undefined && segments.at(-1) !== "..") {
				segments.pop();
			} else if (!absolute) {
				segments.push(segment);
			}
			continue;
		}
		segments.push(segment);
	}
	const prefix = drive === undefined ? (absolute ? "/" : "") : `${drive}/`;
	return `${prefix}${segments.join("/")}` || (absolute ? prefix : ".");
};

/** Keeps the first source provider and records every conflicting provider with provenance. */
const assembleGameSourcesFn = (sources: ReadonlyArray<GameSourceFileSchema.Type>) => {
	const value: GameSourceSchema.Type = {};
	const provenance: GameSourceProvenanceSchema.Type = {
		items: {},
	};
	const diagnostics: GameDiagnosticsSchema.Type = [];

	for (const source of sources) {
		const schemaReference = source.value.$schema;
		if (schemaReference !== undefined) {
			const resolved = resolveSourceReferenceFn(source.path, schemaReference);
			const current = provenance.schema;
			match({
				current,
				resolutionMatches: current?.resolved === resolved,
			})
				.with(
					{
						current: undefined,
					},
					() => {
						value.$schema = schemaReference;
						provenance.schema = {
							path: source.path,
							value: schemaReference,
							resolved,
						};
					},
				)
				.with(
					{
						current: P.nonNullable,
						resolutionMatches: false,
					},
					({ current }) => {
						diagnostics.push({
							code: DiagnosticCodeEnumSchema.enum.SourceSchemaReferenceConflict,
							severity: DiagnosticSeverityEnumSchema.enum.Error,
							path: [
								"$schema",
							],
							source: source.path,
							message: `JSON Schema reference ${JSON.stringify(schemaReference)} conflicts with ${JSON.stringify(current.value)}.`,
							values: [
								current.value,
								schemaReference,
							],
							sources: [
								current.path,
								source.path,
							],
						});
					},
				)
				.with(
					{
						current: P.nonNullable,
						resolutionMatches: true,
					},
					({ current }) => {
						const currentParents = current.value
							.split("/")
							.filter((part) => part === "..").length;
						const nextParents = schemaReference
							.split("/")
							.filter((part) => part === "..").length;
						if (nextParents < currentParents) {
							value.$schema = schemaReference;
							provenance.schema = {
								path: source.path,
								value: schemaReference,
								resolved,
							};
						}
					},
				)
				.exhaustive();
		}

		for (const provider of DiagnosticProviderEnumSchema.options) {
			const providerValue = source.value[provider];
			if (providerValue === undefined) continue;

			const previousPath = provenance[provider];
			if (previousPath !== undefined) {
				diagnostics.push({
					code: DiagnosticCodeEnumSchema.enum.SourceDuplicateProvider,
					severity: DiagnosticSeverityEnumSchema.enum.Error,
					path: [
						provider,
					],
					source: source.path,
					message: `Game field ${provider} is provided by more than one source fragment.`,
					provider,
					sources: [
						previousPath,
						source.path,
					],
				});
				continue;
			}

			provenance[provider] = source.path;
			match(provider)
				.with(DiagnosticProviderEnumSchema.enum.Meta, () => {
					value.meta = source.value.meta;
				})
				.with(DiagnosticProviderEnumSchema.enum.Resources, () => {
					value.resources = source.value.resources;
				})
				.with(DiagnosticProviderEnumSchema.enum.Start, () => {
					value.start = source.value.start;
				})
				.exhaustive();
		}

		const items = source.value.items === undefined ? undefined : (value.items ??= {});
		for (const [key, item] of Object.entries(source.value.items ?? {})) {
			const previousPath = provenance.items[key];
			if (previousPath !== undefined) {
				diagnostics.push({
					code: DiagnosticCodeEnumSchema.enum.SourceDuplicateRecord,
					severity: DiagnosticSeverityEnumSchema.enum.Error,
					path: [
						"items",
						key,
					],
					source: source.path,
					message: `Item ${key} is provided by more than one source fragment.`,
					entity: DiagnosticRecordEntityEnumSchema.enum.Item,
					key,
					sources: [
						previousPath,
						source.path,
					],
				});
				continue;
			}

			provenance.items[key] = source.path;
			items![key] = item;
		}
	}

	return {
		value,
		diagnostics,
		provenance,
	};
};

const readSourcePathFn = (
	path: DiagnosticPathSchema.Type,
	provenance: GameSourceProvenanceSchema.Type,
) => {
	const [root, key] = path;
	if (root === "items" && typeof key === "string") {
		return provenance.items[key];
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
	const assembly = assembleGameSourcesFn(sources);
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
				source: readSourcePathFn(path, assembly.provenance),
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
