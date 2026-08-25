import { FileSystem, Path } from "effect";
import { Effect } from "effect";

import type { ResourceSchema } from "~/engine/pack/schema/ResourceSchema";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { writeGameJsonSchemaFx } from "~/engine/schema/fx/writeGameJsonSchemaFx";

export namespace writeGameSourceDirectoryFx {
	export interface Props {
		readonly config: GameConfigSchema.Type;
		readonly output: string;
		readonly resources: ReadonlyArray<ResourceSchema.Type>;
	}

	export interface Success {
		readonly json: number;
		readonly resources: number;
	}
}

const serializeJson = (value: unknown) => `${JSON.stringify(value, undefined, "\t")}\n`;

const readItemSourceStem = (id: string, type: string) => {
	const namespaced = id.slice(id.lastIndexOf(":") + 1);
	const semantic = type === "blueprint" ? namespaced.replace(/^blueprint-/, "") : namespaced;
	return (
		semantic
			.normalize("NFKD")
			.replace(/[\u0300-\u036f]/g, "")
			.replace(/[^A-Za-z0-9._-]+/g, "-")
			.replace(/^[.-]+|[.-]+$/g, "")
			.toLowerCase() || "item"
	);
};

const assertPortableResourceIdFx = Effect.fn("assertPortableResourceIdFx")(function* (id: string) {
	const path = yield* Path.Path;
	if (path.basename(id) === id && !id.includes("\\") && !id.includes("\0")) return id;
	return yield* Effect.fail(
		new Error(`Resource ${JSON.stringify(id)} cannot be represented by a PNG filename.`),
	);
});

/** Writes one self-contained authoring bundle with items grouped by discriminator. */
export const writeGameSourceDirectoryFx = Effect.fn("writeGameSourceDirectoryFx")(function* ({
	config,
	output,
	resources,
}: writeGameSourceDirectoryFx.Props) {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const root = path.resolve(output);
	const assetsDirectory = path.join(root, "assets");
	const resourcesDirectory = path.join(root, "resources");
	yield* fileSystem.makeDirectory(assetsDirectory, {
		recursive: true,
	});
	yield* fileSystem.makeDirectory(resourcesDirectory, {
		recursive: true,
	});
	yield* writeGameJsonSchemaFx({
		output: path.join(root, "schema.json"),
	});

	const { $schema: _schema, items, ...rootConfig } = config;
	yield* fileSystem.writeFileString(
		path.join(root, "game.json"),
		serializeJson({
			$schema: "./schema.json",
			...rootConfig,
		}),
	);

	const sourceNames = new Map<string, number>();
	for (const [id, item] of Object.entries(items).sort(([left], [right]) =>
		left.localeCompare(right),
	)) {
		const directory = path.join(root, item.type);
		yield* fileSystem.makeDirectory(directory, {
			recursive: true,
		});
		const base = readItemSourceStem(item.id, item.type);
		const key = `${item.type}/${base}`;
		const occurrence = (sourceNames.get(key) ?? 0) + 1;
		sourceNames.set(key, occurrence);
		const stem = occurrence === 1 ? base : `${base}-${occurrence}`;
		yield* fileSystem.writeFileString(
			path.join(directory, `${stem}.json`),
			serializeJson({
				$schema: "../schema.json",
				items: {
					[id]: item,
				},
			}),
		);
	}

	const shellResources = new Set(Object.values(config.resources));
	const resourceWrites = [];
	const resourcePaths = new Map<string, string>();
	for (const resource of [
		...resources,
	].sort((left, right) => left.id.localeCompare(right.id))) {
		if (resource.mime !== "image/png") {
			return yield* Effect.fail(
				new Error(
					`Resource ${resource.id} uses ${resource.mime}; JSON source export supports image/png resources only.`,
				),
			);
		}
		const id = yield* assertPortableResourceIdFx(resource.id);
		const directory = shellResources.has(id) ? resourcesDirectory : assetsDirectory;
		const destination = path.join(directory, `${id}.png`);
		const collisionKey = destination.normalize("NFD").toLowerCase();
		const collidingId = resourcePaths.get(collisionKey);
		if (collidingId !== undefined) {
			return yield* Effect.fail(
				new Error(
					`Resources ${JSON.stringify(collidingId)} and ${JSON.stringify(id)} collide on this filesystem.`,
				),
			);
		}
		resourcePaths.set(collisionKey, id);
		resourceWrites.push({
			bytes: resource.bytes,
			destination,
		});
	}
	for (const resource of resourceWrites) {
		yield* fileSystem.writeFile(resource.destination, resource.bytes);
	}

	return {
		json: Object.keys(items).length + 2,
		resources: resources.length,
	} satisfies writeGameSourceDirectoryFx.Success;
});
