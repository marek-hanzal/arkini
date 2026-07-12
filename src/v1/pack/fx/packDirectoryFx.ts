import { promisify } from "node:util";
import { gzip } from "node:zlib";
import { FileSystem, Path } from "@effect/platform";
import { Effect } from "effect";

import { compileGameDirectoryFx } from "~/v1/compiler/fx/compileGameDirectoryFx";
import { assertGameConfigValidFx } from "~/v1/validation/fx/assertGameConfigValidFx";
import { encodeFx } from "./encodeFx";
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
	const compilation = yield* compileGameDirectoryFx({
		input,
	});
	const pngAssets = yield* Effect.forEach(compilation.resources, ({ path: assetPath }) =>
		readPngAssetFx({
			path: assetPath,
		}),
	);
	const config = yield* assertGameConfigValidFx(compilation);
	const bytes = yield* encodeFx({
		config,
		resources: pngAssets,
	});
	const compressed = yield* Effect.promise(async () => new Uint8Array(await gzipAsync(bytes)));
	const outputPath = path.resolve(
		output ??
			path.join(
				path.dirname(path.resolve(input)),
				`${path.basename(path.resolve(input))}.game.arkpack`,
			),
	);

	yield* fileSystem.makeDirectory(path.dirname(outputPath), {
		recursive: true,
	});
	yield* fileSystem.writeFile(outputPath, compressed);

	return {
		input: path.resolve(input),
		output: outputPath,
		json: compilation.json,
		png: pngAssets.length,
		bytes: compressed.byteLength,
		diagnostics: compilation.diagnostics,
	} as const;
});
