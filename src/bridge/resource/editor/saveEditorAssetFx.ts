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

export namespace saveEditorAssetFx {
	export interface Props {
		readonly file: EditorAssetFileInput;
		readonly projectId: string;
	}
}

/** Validates one PNG and saves it directly into the canonical project repository. */
export const saveEditorAssetFx = Effect.fn("saveEditorAssetFx")(function* ({
	file: inputFile,
	projectId,
}: saveEditorAssetFx.Props) {
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
	const repository = yield* EditorProjectRepository;
	yield* Effect.yieldNow;
	return yield* Effect.uninterruptible(
		Effect.gen(function* () {
			const project = yield* repository.upsertResourceFx({
				projectId,
				resource: {
					id: resourceId,
					mime: "image/png",
					bytes,
				},
			});
			yield* Atom.set(EditorProjectAtom(projectId), {
				project,
			});
			return {
				project,
				resourceId,
			};
		}),
	);
});
