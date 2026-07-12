import { Effect } from "effect";

import type { GameConfigSchema } from "~/v1/schema/GameConfigSchema";
import type { GameSourceProvenanceSchema } from "~/v1/source/schema/GameSourceProvenanceSchema";
import type { ResourceDescriptorSchema } from "~/v1/resource/schema/ResourceDescriptorSchema";
import type { DiagnosticPathSchema } from "~/v1/validation/schema/DiagnosticPathSchema";
import type { GameDiagnosticsSchema } from "~/v1/validation/schema/GameDiagnosticsSchema";

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
			code: "resource:duplicate",
			severity: "error",
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
	for (const [itemId, item] of Object.entries(config.items)) {
		const source = provenance.items[itemId];
		if (item.type === "blueprint") {
			item.asset.forEach((id, index) => {
				references.push({
					id,
					path: [
						"items",
						itemId,
						"asset",
						index,
					],
					source,
				});
			});
			continue;
		}
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
			code: "resource:missing",
			severity: "error",
			path: reference.path,
			source: reference.source,
			message: `Referenced resource ${reference.id} has no matching PNG file.`,
			resourceId: reference.id,
		});
	}
	for (const resource of firstById.values()) {
		if (referenced.has(resource.id)) continue;
		diagnostics.push({
			code: "resource:unused",
			severity: "warning",
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
