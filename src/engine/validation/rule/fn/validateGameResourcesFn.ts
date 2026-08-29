import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import type { GameSourceProvenanceSchema } from "~/engine/source/schema/GameSourceProvenanceSchema";
import type { ResourceDescriptorSchema } from "~/engine/resource/schema/ResourceDescriptorSchema";
import { readGameResourceUsagesFn } from "~/engine/resource/fn/readGameResourceUsagesFn";
import type { GameDiagnosticsSchema } from "~/engine/validation/schema/GameDiagnosticsSchema";
import { DiagnosticCodeEnumSchema } from "~/engine/validation/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/engine/validation/schema/DiagnosticSeverityEnumSchema";

/** Validates exact config-to-PNG resource identity without naming conventions. */
export const validateGameResourcesFn = ({
	config,
	provenance,
	resources,
}: {
	config: GameConfigSchema.Type;
	provenance: GameSourceProvenanceSchema.Type;
	resources: ReadonlyArray<ResourceDescriptorSchema.Type>;
}) => {
	const diagnostics: GameDiagnosticsSchema.Type = [];
	const firstById = new Map<string, ResourceDescriptorSchema.Type>();
	for (const resource of resources) {
		const first = firstById.get(resource.id);
		if (first === undefined) {
			firstById.set(resource.id, resource);
			continue;
		}
		diagnostics.push({
			code: DiagnosticCodeEnumSchema.enum.ResourceDuplicate,
			severity: DiagnosticSeverityEnumSchema.enum.Error,
			path: [
				"resources",
				resource.id,
			],
			source: resource.path,
			message: `Resource ${resource.id} is provided by more than one PNG file.`,
			resourceId: resource.id,
			sources: [
				first.path,
				resource.path,
			],
		});
	}

	const usages = readGameResourceUsagesFn(config);
	const referenced = new Set(usages.map(({ resourceId }) => resourceId));
	for (const usage of usages) {
		if (firstById.has(usage.resourceId)) continue;
		diagnostics.push({
			code: DiagnosticCodeEnumSchema.enum.ResourceMissing,
			severity: DiagnosticSeverityEnumSchema.enum.Error,
			path: usage.path,
			source:
				usage.owner === "project" ? provenance.resources : provenance.items[usage.ownerId],
			message: `Referenced resource ${usage.resourceId} has no matching PNG file.`,
			resourceId: usage.resourceId,
		});
	}
	for (const resource of firstById.values()) {
		if (referenced.has(resource.id)) continue;
		diagnostics.push({
			code: DiagnosticCodeEnumSchema.enum.ResourceUnused,
			severity: DiagnosticSeverityEnumSchema.enum.Warning,
			path: [
				"resources",
				resource.id,
			],
			source: resource.path,
			message: `PNG resource ${resource.id} is not referenced by the completed game config.`,
			resourceId: resource.id,
		});
	}

	return diagnostics;
};
