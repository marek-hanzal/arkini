import { FileSystem, Path } from "effect";
import { Effect } from "effect";

export namespace collectSourceFilesFx {
	export interface Props {
		input: string;
	}
}

const isGameProjectJsonSourceFn = (relative: string) =>
	relative === "game.json" || /^items\/[^/]+\/[^/]+\.json$/.test(relative);

const isGameProjectPngSourceFn = (relative: string) =>
	/^(?:assets|resources)\/[^/]+\.png$/.test(relative);

/** Collects deterministic JSON and PNG source paths from one authoring directory. */
export const collectSourceFilesFx = Effect.fn("collectSourceFilesFx")(function* ({
	input,
}: collectSourceFilesFx.Props) {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const root = path.resolve(input);
	const files = (yield* fileSystem.readDirectory(root, {
		recursive: true,
	}))
		.map((file) => path.join(root, file))
		.sort();
	return {
		root,
		json: files.filter((file) =>
			isGameProjectJsonSourceFn(path.relative(root, file).replaceAll("\\", "/")),
		),
		png: files.filter((file) =>
			isGameProjectPngSourceFn(path.relative(root, file).replaceAll("\\", "/")),
		),
	} as const;
});
