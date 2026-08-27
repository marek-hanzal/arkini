import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { gzip } from "node:zlib";
import { FileSystem, Path } from "effect";
import { Effect, Exit } from "effect";

import { ArkiniAppVersion } from "../../../../shared/ArkiniAppMetadata";
import { compileGameDirectoryFx } from "~/engine/compiler/fx/compileGameDirectoryFx";
import { ArkpackSigningError } from "~/engine/pack/error/ArkpackSigningError";
import type { ArkpackPublicKeySchema } from "~/engine/pack/schema/ArkpackPublicKeySchema";
import type { ArkpackSignKeySchema } from "~/engine/pack/schema/ArkpackSignKeySchema";
import { encodeGameProjectFileStem } from "~/engine/source/encodeGameProjectFileStem";
import { createFilesystemWriteFx } from "~/engine/filesystem/createFilesystemWriteFx";
import { assertGameConfigValidFx } from "~/engine/validation/fx/assertGameConfigValidFx";
import { ArkiniVersionSchema } from "~/engine/version/schema/ArkiniVersionSchema";
import { encodeFx } from "./encodeFx";
import { readArkpackContentHashFx } from "./readArkpackContentHashFx";
import { readPngAssetFx } from "./readPngAssetFx";
import { signArkpackFx } from "./signArkpackFx";
import { verifyArkpackTrustFx } from "./verifyArkpackTrustFx";

const gzipAsync = promisify(gzip);

export namespace packDirectoryFx {
	export interface Props {
		readonly input: string;
		readonly assertCurrentFx?: Effect.Effect<void, unknown, FileSystem.FileSystem | Path.Path>;
		readonly signing?: {
			readonly publicKey: ArkpackPublicKeySchema.Type;
			readonly signKey: ArkpackSignKeySchema.Type;
		};
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
	signing,
}: packDirectoryFx.Props) {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const compilation = yield* compileGameDirectoryFx({
		input,
	});
	const config = yield* assertGameConfigValidFx(compilation);
	const identity = compilation.projectIdentity!;
	const pngAssets = yield* Effect.forEach(compilation.resources, ({ path: assetPath }) =>
		readPngAssetFx({
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
	const contentHash = yield* readArkpackContentHashFx(compressed);
	const signature =
		signing === undefined
			? undefined
			: yield* signArkpackFx({
					bytes: compressed,
					signKey: signing.signKey,
				});
	if (signature !== undefined) {
		const verification = yield* verifyArkpackTrustFx({
			bytes: compressed,
			publicKey: signing!.publicKey,
			signature,
		});
		if (verification.trust.type !== "official") {
			return yield* Effect.fail(
				new ArkpackSigningError({
					reason: "post-sign-verification",
					actualTrust: verification.trust,
					message: "Arkpack post-sign verification did not establish trust.",
				}),
			);
		}
	}

	const root = yield* fileSystem.realPath(path.resolve(input));
	const build = path.join(root, "build");
	const pending = path.join(root, `.build.${randomUUID()}.pending`);
	const previous = path.join(root, `.build.${randomUUID()}.previous`);
	const stem = encodeGameProjectFileStem(identity.packageId);
	const filename = `${stem}.arkpack`;
	const signatureFilename = `${stem}.arksig`;
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
		yield* writeSyncedFileFx(stagedArkpack, compressed);
		if (signature !== undefined) {
			yield* writeSyncedFileFx(
				path.join(pending, signatureFilename),
				new TextEncoder().encode(`${signature}\n`),
			);
		}

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
		...(signature === undefined
			? {}
			: {
					signature,
					signaturePath: path.join(build, signatureFilename),
					signatureFilename,
				}),
		packageId: identity.packageId,
		version: identity.version,
		json: compilation.json,
		png: pngAssets.length,
		bytes: compressed.byteLength,
		content: compressed,
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
		packDirectoryUnlockedFx({
			...props,
			input: root,
		}),
	);
});
