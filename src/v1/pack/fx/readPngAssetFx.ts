import { FileSystem, Path } from "@effect/platform";
import { Effect } from "effect";

export namespace readPngAssetFx {
	export interface Props {
		path: string;
	}
}

export const readPngAssetFx = Effect.fn("readPngAssetFx")(function* ({
	path: assetPath,
}: readPngAssetFx.Props) {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;

	return {
		id: path.basename(assetPath, path.extname(assetPath)),
		mime: "image/png",
		bytes: yield* fileSystem.readFile(assetPath),
	} as const;
});
