import { Effect } from "effect";

import { PngResourceLimits, validatePngResourceFx } from "~/bridge/resource/validatePngResourceFx";
import { IdSchema } from "~/engine/common/schema/IdSchema";
import { EditorProjectError } from "~/engine/editor/error/EditorProjectError";

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
	if (
		!inputFile.name.toLowerCase().endsWith(".png") ||
		inputFile.size > PngResourceLimits.maxBytes
	) {
		return yield* Effect.fail(
			new EditorProjectError({
				reason: "invalid-asset",
				message: `Asset ${inputFile.name} must be a PNG no larger than ${PngResourceLimits.maxBytes} bytes.`,
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
	yield* validatePngResourceFx(bytes, resourceId).pipe(
		Effect.mapError(
			(cause) =>
				new EditorProjectError({
					reason: "invalid-asset",
					message: cause.message.replace(/^Resource /, "Asset "),
					cause,
				}),
		),
	);
	return {
		id: resourceId,
		mime: "image/png",
		bytes,
	} as const;
});
