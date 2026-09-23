import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { GameSourceProvenanceSchema } from "~/game-config-source/schema/GameSourceProvenanceSchema";
import type { ResourceDescriptorSchema } from "~/game-config-resource/schema/ResourceDescriptorSchema";
import { readGameResourceUsagesFn } from "~/game-config-resource/fn/readGameResourceUsagesFn";
import type { GameDiagnosticsSchema } from "~/game-config-diagnostic/schema/GameDiagnosticsSchema";
import { DiagnosticCodeEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticSeverityEnumSchema";

/** Validates exact config-to-resource identity and semantic type. */
export const validateGameResourcesFn = ({
	config,
	provenance,
	resources,
}: {
	config: GameConfigSchema.Type;
	provenance: GameSourceProvenanceSchema.Type;
	resources: ReadonlyArray<Pick<ResourceDescriptorSchema.Type, "uid" | "path" | "type">>;
}) => {
	const diagnostics: GameDiagnosticsSchema.Type = [];
	const firstByUid = new Map<
		string,
		Pick<ResourceDescriptorSchema.Type, "uid" | "path" | "type">
	>();
	for (const resource of resources) {
		const first = firstByUid.get(resource.uid);
		if (first === undefined) {
			firstByUid.set(resource.uid, resource);
			continue;
		}
		diagnostics.push({
			code: DiagnosticCodeEnumSchema.enum.ResourceDuplicate,
			severity: DiagnosticSeverityEnumSchema.enum.Error,
			path: [
				"resources",
				resource.uid,
			],
			source: resource.path,
			message: `Resource ${resource.uid} is provided by more than one source file.`,
			resourceUid: resource.uid,
			sources: [
				first.path,
				resource.path,
			],
		});
	}

	const usages = readGameResourceUsagesFn(config);
	const readUsageSourceFn = (usage: readGameResourceUsagesFn.Usage) =>
		usage.owner === "item"
			? provenance.items[usage.ownerId]
			: usage.path[0] === "music"
				? provenance.music
				: usage.path[0] === "sfx"
					? provenance.sfx
					: provenance.resources;
	const referenced = new Set(usages.map(({ resourceUid }) => resourceUid));
	for (const usage of usages) {
		const resource = firstByUid.get(usage.resourceUid);
		if (resource !== undefined) {
			if (resource.type !== usage.resourceType)
				diagnostics.push({
					code: DiagnosticCodeEnumSchema.enum.ResourceTypeMismatch,
					severity: DiagnosticSeverityEnumSchema.enum.Error,
					path: usage.path,
					source: readUsageSourceFn(usage),
					message: `Referenced resource ${usage.resourceUid} must be ${usage.resourceType}, but its source type is ${resource.type}.`,
					resourceUid: usage.resourceUid,
					expectedType: usage.resourceType,
					actualType: resource.type,
				});
			continue;
		}
		diagnostics.push({
			code: DiagnosticCodeEnumSchema.enum.ResourceMissing,
			severity: DiagnosticSeverityEnumSchema.enum.Error,
			path: usage.path,
			source: readUsageSourceFn(usage),
			message: `Referenced resource ${usage.resourceUid} has no matching source file.`,
			resourceUid: usage.resourceUid,
		});
	}
	for (const resource of firstByUid.values()) {
		if (referenced.has(resource.uid) || resource.type === "music" || resource.type === "sfx")
			continue;
		diagnostics.push({
			code: DiagnosticCodeEnumSchema.enum.ResourceUnused,
			severity: DiagnosticSeverityEnumSchema.enum.Warning,
			path: [
				"resources",
				resource.uid,
			],
			source: resource.path,
			message: `Resource ${resource.uid} is not referenced by the completed game config.`,
			resourceUid: resource.uid,
		});
	}

	return diagnostics;
};
