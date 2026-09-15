import { FileSystem, Path } from "effect";
import { Effect } from "effect";
import type { ResourceTypeSchema } from "~/game-config-resource/schema/ResourceTypeSchema";

export namespace collectSourceFilesFx {
	export interface Props {
		input: string;
	}
}

/** Collects deterministic JSON and typed resource paths from one authoring directory. */
export const collectSourceFilesFx = Effect.fn("collectSourceFilesFx")(function* ({
	input,
}: collectSourceFilesFx.Props) {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const root = path.resolve(input);
	const json: Array<string> = [];
	const resources: Array<{
		readonly path: string;
		readonly type: ResourceTypeSchema.Type;
	}> = [];
	const game = path.join(root, "game.json");
	if (yield* fileSystem.exists(game)) json.push(game);
	const items = path.join(root, "items");
	if (yield* fileSystem.exists(items)) {
		for (const file of yield* fileSystem.readDirectory(items)) {
			if (file.endsWith(".json")) json.push(path.join(items, file));
		}
	}
	for (const type of [
		"artwork",
		"image",
	] as const) {
		const directory = path.join(root, type);
		if (!(yield* fileSystem.exists(directory))) continue;
		for (const file of yield* fileSystem.readDirectory(directory)) {
			if (file.endsWith(".png"))
				resources.push({
					path: path.join(directory, file),
					type,
				});
		}
	}
	return {
		root,
		json: json.sort(),
		resources: resources.sort((left, right) => left.path.localeCompare(right.path)),
	} as const;
});
