import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { gzip } from "node:zlib";
import { FileSystem, Path } from "effect";
import { Effect, Exit } from "effect";

import { ArkiniAppVersion } from "../../../../shared/ArkiniAppMetadata";
import { compileGameDirectoryFx } from "~/game-config-compiler/fx/compileGameDirectoryFx";
import { readArkpackArtifactNameFn } from "~/arkpack/artifact/fn/readArkpackArtifactNameFn";
import { createFilesystemWriteFx } from "~/filesystem-write/fx/createFilesystemWriteFx";
import { isFilesystemPathSafeFx } from "~/filesystem-write/fx/isFilesystemPathSafeFx";
import { assertGameConfigValidFx } from "~/game-config-compiler/fx/assertGameConfigValidFx";
import { ArkiniVersionSchema } from "~/application-version/schema/ArkiniVersionSchema";
import { encodeFx } from "./encodeFx";
import { encodeArkpackEnvelopeFx } from "./encodeArkpackEnvelopeFx";
import { readArkpackContentHashFx } from "./readArkpackContentHashFx";
import { readPngResourceFx } from "~/game-config-resource/fx/readPngResourceFx";

const gzipAsync = promisify(gzip);

export namespace packDirectoryFx {
	export interface Props {
		readonly input: string;
		readonly assertCurrentFx?: Effect.Effect<void, unknown, FileSystem.FileSystem | Path.Path>;
	}
}

const writeSyncedFileFx = Effect.fn("packDirectoryFx.writeSyncedFileFx")(function* (
	filePath: string,
	bytes: Uint8Array,
) {
	const fileSystem = yield* FileSystem.FileSystem;
	yield* Effect.scoped(
		Effect.gen(function* () {
			const file = yield* fileSystem.open(filePath, {
				flag: "w",
			});
			yield* file.writeAll(bytes);
			yield* file.sync;
		}),
	);
});

/** Compiles, validates, and atomically publishes one canonical project build directory. */
const packDirectoryUnlockedFx = Effect.fn("packDirectoryFx.unlocked")(function* ({
	assertCurrentFx,
	input,
}: packDirectoryFx.Props) {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const compilation = yield* compileGameDirectoryFx({
		input,
	});
	const config = yield* assertGameConfigValidFx(compilation);
	const identity = compilation.projectIdentity!;
	const pngAssets = yield* Effect.forEach(compilation.resources, ({ path: assetPath }) =>
		readPngResourceFx({
			path: assetPath,
		}),
	);
	const bytes = yield* encodeFx({
		version: identity.version,
		arkini: ArkiniVersionSchema.parse(ArkiniAppVersion),
		config,
		resources: pngAssets,
	});
	const compressed = yield* Effect.promise(async () => new Uint8Array(await gzipAsync(bytes)));
	const arkpack = yield* encodeArkpackEnvelopeFx({
		payload: compressed,
	});
	const contentHash = yield* readArkpackContentHashFx(arkpack);

	const root = yield* fileSystem.realPath(path.resolve(input));
	const build = path.join(root, "build");
	const pending = path.join(root, `.build.${randomUUID()}.pending`);
	const previous = path.join(root, `.build.${randomUUID()}.previous`);
	const filename = readArkpackArtifactNameFn(identity.packageId);
	if (yield* fileSystem.exists(build)) {
		const canonicalBuild = yield* fileSystem.realPath(build);
		if (canonicalBuild !== path.join(root, "build")) {
			return yield* Effect.fail(
				new Error(`Project build directory ${build} is a symbolic link.`),
			);
		}
	}

	yield* Effect.gen(function* () {
		if (assertCurrentFx !== undefined) yield* assertCurrentFx;
		yield* fileSystem.makeDirectory(pending);
		const stagedArkpack = path.join(pending, filename);
		yield* writeSyncedFileFx(stagedArkpack, arkpack);

		yield* Effect.uninterruptible(
			Effect.gen(function* () {
				const hadPrevious = yield* fileSystem.exists(build);
				if (hadPrevious) yield* fileSystem.rename(build, previous);
				const swap = yield* Effect.exit(fileSystem.rename(pending, build));
				if (Exit.isFailure(swap)) {
					if (hadPrevious) yield* fileSystem.rename(previous, build);
					return yield* Effect.failCause(swap.cause);
				}
				if (hadPrevious) {
					yield* fileSystem
						.remove(previous, {
							force: true,
							recursive: true,
						})
						.pipe(Effect.ignore);
				}
			}),
		);
	}).pipe(
		Effect.ensuring(
			fileSystem
				.remove(pending, {
					force: true,
					recursive: true,
				})
				.pipe(Effect.ignore),
		),
	);

	return {
		input: root,
		build,
		arkpack: path.join(build, filename),
		filename,
		packageId: identity.packageId,
		version: identity.version,
		json: compilation.json,
		png: pngAssets.length,
		bytes: arkpack.byteLength,
		content: arkpack,
		contentHash,
		diagnostics: compilation.diagnostics,
	} as const;
});

export const packDirectoryFx = Effect.fn("packDirectoryFx")(function* (
	props: packDirectoryFx.Props,
) {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const filesystemWrite = yield* createFilesystemWriteFx();
	const root = yield* fileSystem.realPath(path.resolve(props.input));
	return yield* filesystemWrite.withLockFx(
		path.join(root, "editor.lock"),
		Effect.gen(function* () {
			const recovery = path.join(root, "editor.lock.write");
			if (
				!(yield* isFilesystemPathSafeFx(fileSystem, root, recovery)) ||
				(yield* fileSystem.exists(recovery))
			)
				return yield* Effect.fail(
					new Error(
						`Project ${root} has an interrupted Editor transaction at ${recovery}; reopen it in the Editor before packing.`,
					),
				);
			return yield* packDirectoryUnlockedFx({
				...props,
				input: root,
			});
		}),
	);
});
