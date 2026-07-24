import { promisify } from "node:util";
import { gzip } from "node:zlib";
import { FileSystem, Path } from "@effect/platform";
import { Effect } from "effect";

import { compileGameDirectoryFx } from "~/engine/compiler/fx/compileGameDirectoryFx";
import { readArkpackContentHashFx } from "~/engine/pack/fx/readArkpackContentHashFx";
import { readArkpackSignaturePathFx } from "~/engine/pack/fx/readArkpackSignaturePathFx";
import { assertGameConfigValidFx } from "~/engine/validation/fx/assertGameConfigValidFx";
import { encodeFx } from "./encodeFx";
import { ArkpackMetadataSchema } from "~/engine/pack/schema/ArkpackMetadataSchema";
import { readPngAssetFx } from "./readPngAssetFx";

const gzipAsync = promisify(gzip);

export namespace packDirectoryFx {
	export interface Props {
		input: string;
		output?: string;
		metadata?: {
			readonly output: string;
			readonly packageId: string;
		};
	}
}

export const packDirectoryFx = Effect.fn("packDirectoryFx")(function* ({
	input,
	output,
	metadata,
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

	const metadataRecord =
		metadata === undefined
			? undefined
			: ArkpackMetadataSchema.parse({
					namespace: "arkini",
					format: 1,
					packageId: metadata.packageId,
					contentHash,
					gameId: config.meta.id,
					title: config.meta.title,
					configVersion: config.version,
					compressedSize: compressed.byteLength,
				});
	const metadataOutput = metadata === undefined ? undefined : path.resolve(metadata.output);
	if (metadataRecord !== undefined && metadataOutput !== undefined) {
		yield* fileSystem.makeDirectory(path.dirname(metadataOutput), {
			recursive: true,
		});
		yield* fileSystem.writeFileString(
			metadataOutput,
			`${JSON.stringify(metadataRecord, undefined, "\t")}\n`,
		);
	}

	return {
		input: path.resolve(input),
		output: outputPath,
		json: compilation.json,
		png: pngAssets.length,
		bytes: compressed.byteLength,
		contentHash,
		metadata: metadataRecord,
		metadataOutput,
		diagnostics: compilation.diagnostics,
	} as const;
});
