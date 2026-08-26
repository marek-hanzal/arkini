import { FileSystem, Path } from "effect";
import { Effect } from "effect";

export namespace collectSourceFilesFx {
	export interface Props {
		input: string;
	}
}

const isEditorJsonSource = (relative: string) =>
	relative === "game.json" || /^items\/[^/]+\/[^/]+\.json$/.test(relative);

const isEditorPngSource = (relative: string) => /^(?:assets|resources)\/[^/]+\.png$/.test(relative);

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
	const editor = yield* fileSystem.exists(path.join(root, "editor.json"));
	if (editor) {
		return {
			root,
			json: files.filter((file) =>
				isEditorJsonSource(path.relative(root, file).replaceAll("\\", "/")),
			),
			png: files.filter((file) =>
				isEditorPngSource(path.relative(root, file).replaceAll("\\", "/")),
			),
		} as const;
	}

	return {
		root,
		json: files.filter(
			(file) => file.endsWith(".json") && file !== path.join(root, "schema.json"),
		),
		png: files.filter((file) => file.endsWith(".png")),
	} as const;
});
