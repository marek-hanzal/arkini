import { FileSystem, Path } from "effect";
import { Effect } from "effect";

export namespace collectSourceFilesFx {
	export interface Props {
		input: string;
	}
}

/** Collects deterministic JSON and PNG source paths from one authoring directory. */
export const collectSourceFilesFx = Effect.fn("collectSourceFilesFx")(function* ({
	input,
}: collectSourceFilesFx.Props) {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const root = path.resolve(input);
	const json: Array<string> = [];
	const png: Array<string> = [];
	const game = path.join(root, "game.json");
	if (yield* fileSystem.exists(game)) json.push(game);
	const items = path.join(root, "items");
	if (yield* fileSystem.exists(items)) {
		for (const type of yield* fileSystem.readDirectory(items)) {
			const directory = path.join(items, type);
			if ((yield* fileSystem.stat(directory)).type !== "Directory") continue;
			for (const file of yield* fileSystem.readDirectory(directory)) {
				if (file.endsWith(".json")) json.push(path.join(directory, file));
			}
		}
	}
	for (const kind of [
		"assets",
		"resources",
	]) {
		const directory = path.join(root, kind);
		if (!(yield* fileSystem.exists(directory))) continue;
		for (const file of yield* fileSystem.readDirectory(directory)) {
			if (file.endsWith(".png")) png.push(path.join(directory, file));
		}
	}
	return {
		root,
		json: json.sort(),
		png: png.sort(),
	} as const;
});
