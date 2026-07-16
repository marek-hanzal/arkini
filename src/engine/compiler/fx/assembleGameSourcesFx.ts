import path from "node:path";

import { Effect } from "effect";

import type { GameSourceSchema } from "~/engine/schema/GameSourceSchema";
import type { GameSourceAssemblySchema } from "../schema/GameSourceAssemblySchema";
import type { GameSourceFileSchema } from "~/engine/source/schema/GameSourceFileSchema";
import type { GameSourceProvenanceSchema } from "~/engine/source/schema/GameSourceProvenanceSchema";
import type { GameDiagnosticsSchema } from "~/engine/validation/schema/GameDiagnosticsSchema";

/**
 * Assembles parsed source fragments without allowing later files to overwrite
 * earlier providers silently. The first provider remains the deterministic
 * candidate while every conflicting provider is reported with provenance.
 */
export const assembleGameSourcesFx = Effect.fn("assembleGameSourcesFx")(function* (
	sources: ReadonlyArray<GameSourceFileSchema.Type>,
) {
	const value: GameSourceSchema.Type = {};
	const provenance: GameSourceProvenanceSchema.Type = {
		categories: {},
		items: {},
	};
	const diagnostics: GameDiagnosticsSchema.Type = [];

	for (const source of sources) {
		if (source.value.$schema !== undefined) {
			const resolved = path.resolve(path.dirname(source.path), source.value.$schema);
			if (provenance.schema === undefined) {
				value.$schema = source.value.$schema;
				provenance.schema = {
					path: source.path,
					value: source.value.$schema,
					resolved,
				};
			} else if (provenance.schema.resolved !== resolved) {
				diagnostics.push({
					code: "source:schema-reference-conflict",
					severity: "error",
					path: [
						"$schema",
					],
					source: source.path,
					message: `JSON Schema reference ${JSON.stringify(source.value.$schema)} conflicts with ${JSON.stringify(provenance.schema.value)}.`,
					values: [
						provenance.schema.value,
						source.value.$schema,
					],
					sources: [
						provenance.schema.path,
						source.path,
					],
				});
			} else {
				const currentParents = provenance.schema.value
					.split("/")
					.filter((part) => part === "..").length;
				const nextParents = source.value.$schema
					.split("/")
					.filter((part) => part === "..").length;
				if (nextParents < currentParents) {
					value.$schema = source.value.$schema;
					provenance.schema = {
						path: source.path,
						value: source.value.$schema,
						resolved,
					};
				}
			}
		}

		for (const provider of [
			"meta",
			"resources",
			"start",
			"version",
		] as const) {
			const providerValue = source.value[provider];
			if (providerValue === undefined) {
				continue;
			}

			const previousPath = provenance[provider];
			if (previousPath !== undefined) {
				diagnostics.push({
					code: "source:duplicate-provider",
					severity: "error",
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
			switch (provider) {
				case "meta":
					value.meta = source.value.meta;
					break;
				case "resources":
					value.resources = source.value.resources;
					break;
				case "start":
					value.start = source.value.start;
					break;
				case "version":
					value.version = source.value.version;
					break;
			}
		}

		const categories =
			source.value.categories === undefined ? undefined : (value.categories ??= {});

		for (const [key, category] of Object.entries(source.value.categories ?? {})) {
			const previousPath = provenance.categories[key];
			if (previousPath !== undefined) {
				diagnostics.push({
					code: "source:duplicate-record",
					severity: "error",
					path: [
						"categories",
						key,
					],
					source: source.path,
					message: `Category ${key} is provided by more than one source fragment.`,
					entity: "category",
					key,
					sources: [
						previousPath,
						source.path,
					],
				});
				continue;
			}

			provenance.categories[key] = source.path;
			categories![key] = category;
		}

		const items = source.value.items === undefined ? undefined : (value.items ??= {});

		for (const [key, item] of Object.entries(source.value.items ?? {})) {
			const previousPath = provenance.items[key];
			if (previousPath !== undefined) {
				diagnostics.push({
					code: "source:duplicate-record",
					severity: "error",
					path: [
						"items",
						key,
					],
					source: source.path,
					message: `Item ${key} is provided by more than one source fragment.`,
					entity: "item",
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
	} satisfies GameSourceAssemblySchema.Type;
});
