import { FileSystem, Path } from "effect";
import { Effect } from "effect";

export namespace readPngResourceFx {
	export interface Props {
		path: string;
	}
}

export const readPngResourceFx = Effect.fn("readPngResourceFx")(function* ({
	path: assetPath,
}: readPngResourceFx.Props) {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;

	return {
		id: path.basename(assetPath, path.extname(assetPath)),
		mime: "image/png",
		bytes: yield* fileSystem.readFile(assetPath),
	} as const;
});
