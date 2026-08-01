import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { EditorProjectAtom } from "~/bridge/editor/EditorProjectAtom";
import { EditorProjectRepository } from "~/bridge/editor/EditorProjectRepository";
import { IdSchema } from "~/engine/common/schema/IdSchema";
import { EditorProjectError } from "~/engine/editor/error/EditorProjectError";

const pngMagic = [
	137,
	80,
	78,
	71,
	13,
	10,
	26,
	10,
] as const;
const maxPngBytes = 16 * 1024 * 1024;
const maxPngDimension = 8192;
const maxPngPixels = 16 * 1024 * 1024;

interface EditorAssetFileInput {
	readonly name: string;
	readonly size: number;
	readonly arrayBuffer: () => Promise<ArrayBuffer>;
}

const readResourceId = (filename: string) =>
	filename
		.replace(/\.png$/i, "")
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^A-Za-z0-9._-]+/g, "-")
		.replace(/^[.-]+|[.-]+$/g, "")
		.toLowerCase();

const readPngDimensionsFx = (bytes: Uint8Array, resourceId: string) =>
	Effect.scoped(
		Effect.gen(function* () {
			const bitmap = yield* Effect.acquireRelease(
				Effect.tryPromise({
					try: () =>
						createImageBitmap(
							new Blob(
								[
									bytes.slice().buffer,
								],
								{
									type: "image/png",
								},
							),
						),
					catch: (cause) =>
						new EditorProjectError({
							reason: "invalid-asset",
							message: `Asset ${resourceId} must decode as a valid PNG image.`,
							cause,
						}),
				}),
				(bitmap) => Effect.sync(() => bitmap.close()),
			);
			return {
				height: bitmap.height,
				width: bitmap.width,
			};
		}),
	);

export namespace saveEditorAssetsFx {
	export interface Props {
		readonly files: ReadonlyArray<EditorAssetFileInput>;
		readonly projectId: string;
	}
}

const validateEditorAssetFileFx = Effect.fn("validateEditorAssetFileFx")(function* (
	inputFile: EditorAssetFileInput,
) {
	if (!inputFile.name.toLowerCase().endsWith(".png") || inputFile.size > maxPngBytes) {
		return yield* Effect.fail(
			new EditorProjectError({
				reason: "invalid-asset",
				message: `Asset ${inputFile.name} must be a PNG no larger than ${maxPngBytes} bytes.`,
			}),
		);
	}
	const resourceId = yield* Effect.try({
		try: () => IdSchema.parse(readResourceId(inputFile.name)),
		catch: (cause) =>
			new EditorProjectError({
				reason: "invalid-resource-id",
				message: `Asset ${inputFile.name} does not produce a valid resource ID.`,
				cause,
			}),
	});
	const bytes = yield* Effect.tryPromise({
		try: async () => new Uint8Array(await inputFile.arrayBuffer()),
		catch: (cause) =>
			new EditorProjectError({
				reason: "invalid-asset",
				message: `Asset ${resourceId} could not be read.`,
				cause,
			}),
	});
	const hasPngEnvelope =
		bytes.byteLength >= 24 &&
		bytes.byteLength <= maxPngBytes &&
		pngMagic.every((byte, index) => bytes[index] === byte);
	if (!hasPngEnvelope) {
		return yield* Effect.fail(
			new EditorProjectError({
				reason: "invalid-asset",
				message: `Asset ${resourceId} must be a valid bounded PNG image.`,
			}),
		);
	}
	const { height, width } = yield* readPngDimensionsFx(bytes, resourceId);
	if (
		width < 1 ||
		height < 1 ||
		width > maxPngDimension ||
		height > maxPngDimension ||
		width * height > maxPngPixels
	) {
		return yield* Effect.fail(
			new EditorProjectError({
				reason: "invalid-asset",
				message: `Asset ${resourceId} exceeds the supported PNG dimensions.`,
			}),
		);
	}
	return {
		id: resourceId,
		mime: "image/png",
		bytes,
	} as const;
});

/** Validates one selected PNG batch and atomically saves it into the canonical project. */
export const saveEditorAssetsFx = Effect.fn("saveEditorAssetsFx")(function* ({
	files,
	projectId,
}: saveEditorAssetsFx.Props) {
	if (files.length === 0) {
		return yield* Effect.fail(
			new EditorProjectError({
				reason: "invalid-asset",
				message: "Select at least one PNG asset to import.",
			}),
		);
	}
	const resources = yield* Effect.forEach(files, validateEditorAssetFileFx, {
		concurrency: "unbounded",
	});
	const resourceIds = new Set<string>();
	for (const resource of resources) {
		if (resourceIds.has(resource.id)) {
			return yield* Effect.fail(
				new EditorProjectError({
					reason: "invalid-resource-id",
					message: `Asset ID ${resource.id} occurs more than once in the selected batch.`,
				}),
			);
		}
		resourceIds.add(resource.id);
	}
	const repository = yield* EditorProjectRepository;
	yield* Effect.yieldNow;
	return yield* Effect.uninterruptible(
		Effect.gen(function* () {
			const project = yield* repository.upsertResourcesFx({
				projectId,
				resources,
			});
			yield* Atom.set(EditorProjectAtom(projectId), {
				project,
			});
			return {
				project,
				resourceIds: resources.map(({ id }) => id),
			};
		}),
	);
});
