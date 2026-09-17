import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { open, stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { FileSystem, Path } from "effect";
import { Effect } from "effect";

import { ArkiniAppVersion } from "~shared/ArkiniAppMetadata";
import { compileGameDirectoryFx } from "~/game-config-compiler/fx/compileGameDirectoryFx";
import { readArkpackArtifactNameFn } from "~/arkpack-artifact/fn/readArkpackArtifactNameFn";
import { createFilesystemWriteFx } from "~/filesystem-write/fx/createFilesystemWriteFx";
import { assertGameConfigValidFx } from "~/game-config-compiler/fx/assertGameConfigValidFx";
import { ArkiniVersionSchema } from "~/application-version/schema/ArkiniVersionSchema";
import { ArkpackLimits } from "~shared/ArkpackLimits";
import { Magic } from "~/arkpack-artifact/constant/Magic";
import { ManifestSchema } from "~/arkpack-artifact/schema/ManifestSchema";
import { normalizeArtworkPngFileFx } from "~/game-config-resource/fx/normalizeArtworkPngFileFx";
import { validateOggOpusFileFx } from "~/game-config-resource/fx/validateOggOpusFileFx";
import { validatePngResourceFileFx } from "~/game-config-resource/fx/validatePngResourceFileFx";
import type { ResourceTypeSchema } from "~/game-config-resource/schema/ResourceTypeSchema";

export namespace packDirectoryFx {
	export interface Props {
		readonly input: string;
	}
}

function* encodeJsonChunksFn(value: unknown): Generator<string> {
	if (value === null) {
		yield "null";
		return;
	}
	if (Array.isArray(value)) {
		yield "[";
		for (let index = 0; index < value.length; index += 1) {
			if (index > 0) yield ",";
			yield* encodeJsonChunksFn(value[index] ?? null);
		}
		yield "]";
		return;
	}
	if (typeof value === "object") {
		yield "{";
		let emitted = false;
		for (const [key, entry] of Object.entries(value)) {
			if (entry === undefined || typeof entry === "function" || typeof entry === "symbol")
				continue;
			if (emitted) yield ",";
			emitted = true;
			yield JSON.stringify(key);
			yield ":";
			yield* encodeJsonChunksFn(entry);
		}
		yield "}";
		return;
	}
	const encoded = JSON.stringify(value);
	yield encoded === undefined ? "null" : encoded;
}

const writeJsonFileFx = Effect.fn("packDirectoryFx.writeJsonFileFx")(
	(target: string, value: unknown) =>
		Effect.tryPromise({
			try: async () => {
				await pipeline(
					Readable.from(encodeJsonChunksFn(value), {
						encoding: "utf8",
					}),
					createWriteStream(target, {
						flags: "wx",
					}),
				);
				return Number((await stat(target)).size);
			},
			catch: (cause) => cause,
		}),
);

interface PackedResourceFile {
	readonly id: string;
	readonly type: ResourceTypeSchema.Type;
	readonly path: string;
	readonly length: number;
}

const writeArkpackFx = Effect.fn("packDirectoryFx.writeArkpackFx")(
	(target: string, manifestPath: string, configPath: string, resources: PackedResourceFile[]) =>
		Effect.tryPromise({
			try: async () => {
				const manifestLength = Number((await stat(manifestPath)).size);
				const configLength = Number((await stat(configPath)).size);
				const payloadLength =
					4 +
					manifestLength +
					configLength +
					resources.reduce((total, resource) => total + resource.length, 0);
				if (payloadLength < 1 || payloadLength > ArkpackLimits.maxPayloadBytes)
					throw new Error(`Invalid Arkpack payload length ${payloadLength}.`);
				const file = await open(target, "wx");
				const contentHash = createHash("sha256");
				const writeFn = async (bytes: Uint8Array, payload: boolean) => {
					let offset = 0;
					while (offset < bytes.byteLength) {
						const { bytesWritten } = await file.write(
							bytes,
							offset,
							bytes.byteLength - offset,
							null,
						);
						if (bytesWritten === 0) throw new Error("Arkpack write made no progress.");
						offset += bytesWritten;
					}
					if (payload) contentHash.update(bytes);
				};
				const copyPayloadFileFn = async (source: string) => {
					for await (const chunk of createReadStream(source))
						await writeFn(chunk as Buffer, true);
				};
				try {
					const envelopeHeader = new Uint8Array(Magic.byteLength + 4);
					envelopeHeader.set(Magic);
					new DataView(envelopeHeader.buffer).setUint32(
						Magic.byteLength,
						payloadLength,
						true,
					);
					await writeFn(envelopeHeader, false);
					const payloadHeader = new Uint8Array(4);
					new DataView(payloadHeader.buffer).setUint32(0, manifestLength, true);
					await writeFn(payloadHeader, true);
					await copyPayloadFileFn(manifestPath);
					await copyPayloadFileFn(configPath);
					for (const resource of resources) await copyPayloadFileFn(resource.path);
				} finally {
					await file.close();
				}
				return {
					bytes: Magic.byteLength + 4 + payloadLength,
					contentHash: contentHash.digest("hex"),
				};
			},
			catch: (cause) => cause,
		}),
);

/** Compiles, validates, and publishes one canonical project build directory. */
const packDirectoryUnlockedFx = Effect.fn("packDirectoryFx.unlocked")(function* ({
	input,
}: packDirectoryFx.Props) {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const compilation = yield* compileGameDirectoryFx({
		input,
	});
	const config = yield* assertGameConfigValidFx(compilation);
	const identity = compilation.projectIdentity!;
	const root = yield* fileSystem.realPath(path.resolve(input));
	const build = path.join(root, "build");
	const temporary = path.join(root, `.arkpack-build.${randomUUID()}`);
	const filename = readArkpackArtifactNameFn(identity.packageId);
	const artifact = yield* Effect.gen(function* () {
		yield* fileSystem.makeDirectory(temporary);
		const resourcesRoot = path.join(temporary, "resources");
		yield* fileSystem.makeDirectory(resourcesRoot);
		const resources: PackedResourceFile[] = [];
		const playlistIds = new Set(config.music?.playlist ?? []);
		const packedResources = compilation.resources.filter(
			(resource) => resource.type !== "music" || playlistIds.has(resource.id),
		);
		for (let index = 0; index < packedResources.length; index += 1) {
			const resource = packedResources[index];
			const target = path.join(resourcesRoot, String(index).padStart(6, "0"));
			const length =
				resource.type === "artwork"
					? yield* normalizeArtworkPngFileFx(resource.path, target, resource.id)
					: resource.type === "image"
						? yield* validatePngResourceFileFx(resource.path, resource.id)
						: yield* validateOggOpusFileFx(resource.path, resource.id);
			resources.push({
				id: resource.id,
				type: resource.type,
				path: resource.type === "artwork" ? target : resource.path,
				length,
			});
		}
		const configPath = path.join(temporary, "config.json");
		const configLength = yield* writeJsonFileFx(configPath, config);
		if (configLength > ArkpackLimits.maxConfigBytes)
			return yield* Effect.fail(
				new Error(`Arkpack config exceeds the ${ArkpackLimits.maxConfigBytes} byte limit.`),
			);
		const manifestPath = path.join(temporary, "manifest.json");
		const manifest = ManifestSchema.parse({
			version: identity.version,
			arkini: ArkiniVersionSchema.parse(ArkiniAppVersion),
			length: configLength,
			resources: resources.map(({ id, type, length }) => ({
				id,
				type,
				length,
			})),
		});
		const manifestLength = yield* writeJsonFileFx(manifestPath, manifest);
		if (manifestLength > ArkpackLimits.maxManifestBytes)
			return yield* Effect.fail(
				new Error(
					`Arkpack manifest exceeds the ${ArkpackLimits.maxManifestBytes} byte limit.`,
				),
			);
		const stagedArkpack = path.join(temporary, filename);
		const artifact = yield* writeArkpackFx(stagedArkpack, manifestPath, configPath, resources);
		yield* fileSystem.remove(build, {
			force: true,
			recursive: true,
		});
		yield* fileSystem.makeDirectory(build);
		yield* fileSystem.rename(stagedArkpack, path.join(build, filename));
		return {
			...artifact,
			resources: resources.length,
		};
	}).pipe(
		Effect.ensuring(
			fileSystem
				.remove(temporary, {
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
		resources: artifact.resources,
		bytes: artifact.bytes,
		contentHash: artifact.contentHash,
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
