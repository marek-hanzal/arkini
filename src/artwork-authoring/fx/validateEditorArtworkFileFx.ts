import { Effect } from "effect";

import { PngResourceLimits } from "~/game-config-resource/constant/PngResourceLimits";
import { readImportedResourceIdFn } from "~/game-config-resource/fn/readImportedResourceIdFn";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { ProjectOperationError } from "~/project-authoring/error/ProjectOperationError";

export type EditorArtworkFileInput = File;

/** Admits one browser file as a bounded Editor PNG resource. */
export const validateEditorArtworkFileFx = Effect.fn("validateEditorArtworkFileFx")(function* (
	inputFile: EditorArtworkFileInput,
	resourceIdOverride?: string,
) {
	if (
		!inputFile.name.toLowerCase().endsWith(".png") ||
		inputFile.size > PngResourceLimits.maxBytes
	) {
		return yield* Effect.fail(
			new ProjectOperationError({
				reason: "invalid-artwork",
				message: `Artwork ${inputFile.name} must be a PNG no larger than ${PngResourceLimits.maxBytes} bytes.`,
			}),
		);
	}
	const projectedResourceId = resourceIdOverride ?? readImportedResourceIdFn(inputFile.name);
	const resourceId = yield* Effect.try({
		try: () => IdSchema.parse(projectedResourceId),
		catch: (cause) =>
			new ProjectOperationError({
				reason: "invalid-resource-id",
				message: `Artwork ${inputFile.name} does not produce a valid resource ID.`,
				cause,
			}),
	});
	const bitmap = yield* Effect.tryPromise({
		try: () => createImageBitmap(inputFile),
		catch: (cause) =>
			new ProjectOperationError({
				reason: "invalid-artwork",
				message: `Artwork ${resourceId} could not be read.`,
				cause,
			}),
	});
	try {
		if (
			bitmap.width < 1 ||
			bitmap.height < 1 ||
			bitmap.width !== bitmap.height ||
			bitmap.width > PngResourceLimits.maxDimension ||
			bitmap.height > PngResourceLimits.maxDimension ||
			bitmap.width * bitmap.height > PngResourceLimits.maxPixels
		)
			return yield* Effect.fail(
				new ProjectOperationError({
					reason: "invalid-artwork",
					message: `Artwork ${resourceId} must be a square PNG within the supported dimensions.`,
				}),
			);
	} finally {
		bitmap.close();
	}
	return {
		id: resourceId,
		type: "artwork",
		size: inputFile.size,
	} as const;
});
