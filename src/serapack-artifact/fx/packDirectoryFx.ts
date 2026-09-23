import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { open, stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { FileSystem, Path } from "effect";
import { readGameResourceUsagesFn } from "~/game-config-resource/fn/readGameResourceUsagesFn";
import { Effect } from "effect";

import { SerakkiAppVersion } from "~shared/SerakkiAppMetadata";
import { compileGameDirectoryFx } from "~/game-config-compiler/fx/compileGameDirectoryFx";
import { readSerapackArtifactNameFn } from "~/serapack-artifact/fn/readSerapackArtifactNameFn";
import { createFilesystemWriteFx } from "~/filesystem-write/fx/createFilesystemWriteFx";
import { assertGameConfigValidFx } from "~/game-config-compiler/fx/assertGameConfigValidFx";
import { SerakkiVersionSchema } from "~/application-version/schema/SerakkiVersionSchema";
import { SerapackLimits } from "~shared/SerapackLimits";
import { Magic } from "~/serapack-artifact/constant/Magic";
import { ManifestSchema } from "~/serapack-artifact/schema/ManifestSchema";
import { normalizeArtworkPngFileFx } from "~/game-config-resource/fx/normalizeArtworkPngFileFx";
import { validateOggOpusFileFx } from "~/game-config-resource/fx/validateOggOpusFileFx";
import { validatePngResourceFileFx } from "~/game-config-resource/fx/validatePngResourceFileFx";
import { GameProjectManifestFileName } from "~/game-config-source/constant/GameProjectReference";
import { GameProjectManifestSchema } from "~/game-config-source/schema/GameProjectManifestSchema";
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
	readonly uid: string;
	readonly type: ResourceTypeSchema.Type;
	readonly path: string;
	readonly length: number;
}

const writeSerapackFx = Effect.fn("packDirectoryFx.writeSerapackFx")(
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
				if (payloadLength < 1 || payloadLength > SerapackLimits.maxPayloadBytes)
					throw new Error(`Invalid Serapack payload length ${payloadLength}.`);
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
						if (bytesWritten === 0) throw new Error("Serapack write made no progress.");
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
	const projectManifestSource = yield* fileSystem.readFileString(
		path.join(root, GameProjectManifestFileName),
	);
	const projectManifest = yield* Effect.try({
		try: () => GameProjectManifestSchema.parse(JSON.parse(projectManifestSource)),
		catch: (cause) => cause,
	});
	const build = path.join(root, "build");
	const temporary = path.join(root, `.serapack-build.${randomUUID()}`);
	const filename = readSerapackArtifactNameFn(identity.packageId);
	const artifact = yield* Effect.gen(function* () {
		yield* fileSystem.makeDirectory(temporary);
		const resourcesRoot = path.join(temporary, "resources");
		yield* fileSystem.makeDirectory(resourcesRoot);
		const resources: PackedResourceFile[] = [];
		const musicUids = new Set(
			readGameResourceUsagesFn(config)
				.filter((usage) => usage.resourceType === "music")
				.map((usage) => usage.resourceUid),
		);
		const packedResources = compilation.resources.filter(
			(resource) => resource.type !== "music" || musicUids.has(resource.uid),
		);
		for (let index = 0; index < packedResources.length; index += 1) {
			const resource = packedResources[index];
			const target = path.join(resourcesRoot, String(index).padStart(6, "0"));
			// Validate and pack the same owned bytes; external editors do not take editor.lock.
			if (resource.type !== "artwork") yield* fileSystem.copyFile(resource.path, target);
			const length =
				resource.type === "artwork"
					? yield* normalizeArtworkPngFileFx(resource.path, target, resource.uid)
					: resource.type === "image"
						? yield* validatePngResourceFileFx(target, resource.uid)
						: yield* validateOggOpusFileFx(target, resource.uid);
			resources.push({
				uid: resource.uid,
				type: resource.type,
				path: target,
				length,
			});
		}
		const configPath = path.join(temporary, "config.json");
		const configLength = yield* writeJsonFileFx(configPath, config);
		if (configLength > SerapackLimits.maxConfigBytes)
			return yield* Effect.fail(
				new Error(
					`Serapack config exceeds the ${SerapackLimits.maxConfigBytes} byte limit.`,
				),
			);
		const manifestPath = path.join(temporary, "manifest.json");
		const manifest = ManifestSchema.parse({
			version: identity.version,
			serakki: SerakkiVersionSchema.parse(SerakkiAppVersion),
			projectRevision: projectManifest.revision,
			length: configLength,
			resources: resources.map(({ uid, type, length }) => ({
				uid,
				type,
				length,
			})),
		});
		const manifestLength = yield* writeJsonFileFx(manifestPath, manifest);
		if (manifestLength > SerapackLimits.maxManifestBytes)
			return yield* Effect.fail(
				new Error(
					`Serapack manifest exceeds the ${SerapackLimits.maxManifestBytes} byte limit.`,
				),
			);
		const stagedSerapack = path.join(temporary, filename);
		const artifact = yield* writeSerapackFx(
			stagedSerapack,
			manifestPath,
			configPath,
			resources,
		);
		yield* fileSystem.remove(build, {
			force: true,
			recursive: true,
		});
		yield* fileSystem.makeDirectory(build);
		yield* fileSystem.rename(stagedSerapack, path.join(build, filename));
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
		serapack: path.join(build, filename),
		filename,
		packageId: identity.packageId,
		projectRevision: projectManifest.revision,
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
