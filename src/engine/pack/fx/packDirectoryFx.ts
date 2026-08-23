import { promisify } from "node:util";
import { gzip } from "node:zlib";
import { FileSystem, Path } from "effect";
import { Effect } from "effect";

import { ArkiniAppVersion } from "../../../../shared/ArkiniAppMetadata";
import { compileGameDirectoryFx } from "~/engine/compiler/fx/compileGameDirectoryFx";
import { readArkpackContentHashFx } from "~/engine/pack/fx/readArkpackContentHashFx";
import { readArkpackSignaturePathFx } from "~/engine/pack/fx/readArkpackSignaturePathFx";
import { assertGameConfigValidFx } from "~/engine/validation/fx/assertGameConfigValidFx";
import type { ArkpackVersionSchema } from "~/engine/version/schema/ArkpackVersionSchema";
import { ArkiniVersionSchema } from "~/engine/version/schema/ArkiniVersionSchema";
import { encodeFx } from "./encodeFx";
import { readPngAssetFx } from "./readPngAssetFx";

const gzipAsync = promisify(gzip);

export namespace packDirectoryFx {
	export interface Props {
		input: string;
		output?: string;
		packageId: string;
		version: ArkpackVersionSchema.Type;
	}
}

/**
 * Compiles one authoring directory into exact compressed Arkpack bytes.
 *
 * Packing is gated by the completed-game compiler and semantic diagnostics.
 * Rewriting an output always removes its detached signature sidecar because any
 * prior signature belongs to the previous bytes; the signed workflow owns signing
 * and post-verification as a separate stricter boundary.
 */
export const packDirectoryFx = Effect.fn("packDirectoryFx")(function* ({
	input,
	output,
	packageId,
	version,
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
		packageId,
		version,
		game: ArkiniVersionSchema.parse(ArkiniAppVersion),
		config,
		resources: pngAssets,
	});
	const compressed = yield* Effect.promise(async () => new Uint8Array(await gzipAsync(bytes)));
	const contentHash = yield* readArkpackContentHashFx(compressed);
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
	yield* fileSystem.remove(yield* readArkpackSignaturePathFx(outputPath), {
		force: true,
	});

	return {
		input: path.resolve(input),
		output: outputPath,
		json: compilation.json,
		png: pngAssets.length,
		bytes: compressed.byteLength,
		contentHash,
		diagnostics: compilation.diagnostics,
	} as const;
});
