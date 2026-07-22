import { Effect } from "effect";

import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import type { GameSourceProvenanceSchema } from "~/engine/source/schema/GameSourceProvenanceSchema";
import type { ResourceDescriptorSchema } from "~/engine/resource/schema/ResourceDescriptorSchema";
import type { DiagnosticPathSchema } from "~/engine/validation/schema/DiagnosticPathSchema";
import type { GameDiagnosticsSchema } from "~/engine/validation/schema/GameDiagnosticsSchema";
import { DiagnosticCodeEnumSchema } from "~/engine/validation/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/engine/validation/schema/DiagnosticSeverityEnumSchema";

interface ResourceReference {
	readonly id: string;
	readonly path: DiagnosticPathSchema.Type;
	readonly source?: string;
}

/** Validates exact config-to-PNG resource identity without naming conventions. */
export const validateGameResourcesFx = Effect.fn("validateGameResourcesFx")(function* ({
	config,
	provenance,
	resources,
}: {
	config: GameConfigSchema.Type;
	provenance: GameSourceProvenanceSchema.Type;
	resources: ReadonlyArray<ResourceDescriptorSchema.Type>;
}) {
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

	const references: ResourceReference[] = [
		{
			id: config.resources.hero,
			path: [
				"resources",
				"hero",
			],
			source: provenance.resources,
		},
	];
	for (const role of [
		"avatar-01",
		"avatar-02",
		"avatar-03",
		"avatar-04",
		"avatar-05",
		"avatar-06",
		"avatar-07",
	] as const) {
		const id = config.resources[role];
		if (id === undefined) continue;
		references.push({
			id,
			path: [
				"resources",
				role,
			],
			source: provenance.resources,
		});
	}

	for (const [itemId, item] of Object.entries(config.items)) {
		const source = provenance.items[itemId];
		item.asset.source.forEach((id, index) => {
			references.push({
				id,
				path: [
					"items",
					itemId,
					"asset",
					"source",
					index,
				],
				source,
			});
		});
		if (item.asset.composite !== undefined) {
			references.push({
				id: item.asset.composite,
				path: [
					"items",
					itemId,
					"asset",
					"composite",
				],
				source,
			});
		}
	}

	const referenced = new Set(references.map(({ id }) => id));
	for (const reference of references) {
		if (firstById.has(reference.id)) continue;
		diagnostics.push({
			code: DiagnosticCodeEnumSchema.enum.ResourceMissing,
			severity: DiagnosticSeverityEnumSchema.enum.Error,
			path: reference.path,
			source: reference.source,
			message: `Referenced resource ${reference.id} has no matching PNG file.`,
			resourceId: reference.id,
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
});
