import { promisify } from "node:util";
import { gzip } from "node:zlib";
import { FileSystem, Path } from "@effect/platform";
import { Effect } from "effect";

import { collectSourceFilesFx } from "./collectSourceFilesFx";
import { encodeFx } from "./encodeFx";
import { mergeSourceFx } from "./mergeSourceFx";
import { readJsonSourceFx } from "./readJsonSourceFx";
import { readPngAssetFx } from "./readPngAssetFx";

const gzipAsync = promisify(gzip);

export namespace packDirectoryFx {
	export interface Props {
		input: string;
		output?: string;
	}
}

export const packDirectoryFx = Effect.fn("packDirectoryFx")(function* ({
	input,
	output,
}: packDirectoryFx.Props) {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const sourceFiles = yield* collectSourceFilesFx({
		input,
	});
	const jsonSources = yield* Effect.forEach(sourceFiles.json, (sourcePath) =>
		readJsonSourceFx({
			path: sourcePath,
		}),
	);
	const pngAssets = yield* Effect.forEach(sourceFiles.png, (assetPath) =>
		readPngAssetFx({
			path: assetPath,
		}),
	);
	const config = yield* mergeSourceFx(jsonSources.map((source) => source.value));
	const bytes = yield* encodeFx({
		config,
		resources: pngAssets,
	});
	const compressed = yield* Effect.promise(async () => new Uint8Array(await gzipAsync(bytes)));
	const outputPath = path.resolve(
		output ??
			path.join(
				path.dirname(sourceFiles.root),
				`${path.basename(sourceFiles.root)}.game.arkpack`,
			),
	);

	yield* fileSystem.makeDirectory(path.dirname(outputPath), {
		recursive: true,
	});
	yield* fileSystem.writeFile(outputPath, compressed);

	return {
		input: sourceFiles.root,
		output: outputPath,
		json: jsonSources.length,
		png: pngAssets.length,
		bytes: compressed.byteLength,
	} as const;
});
