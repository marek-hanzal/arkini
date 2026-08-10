import { Effect } from "effect";

import { readEditorPngDimensionsFx } from "~/bridge/resource/editor/readEditorPngDimensionsFx";
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

export interface EditorAssetFileInput {
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

export const validateEditorAssetFileFx = Effect.fn("validateEditorAssetFileFx")(function* (
	inputFile: EditorAssetFileInput,
	resourceIdOverride?: string,
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
		try: () => IdSchema.parse(resourceIdOverride ?? readResourceId(inputFile.name)),
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
	const { height, width } = yield* readEditorPngDimensionsFx(bytes, resourceId);
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
