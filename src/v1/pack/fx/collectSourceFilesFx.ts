import { FileSystem, Path } from "@effect/platform";
import { Effect } from "effect";

export namespace collectSourceFilesFx {
	export interface Props {
		input: string;
	}
}

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
		json: files.filter((file) => file.endsWith(".json")),
		png: files.filter((file) => file.endsWith(".png")),
	} as const;
});
