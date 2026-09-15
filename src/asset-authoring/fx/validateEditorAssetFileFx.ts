import { Effect } from "effect";

import { PngResourceLimits } from "~/game-config-resource/constant/PngResourceLimits";
import { readEditorAssetResourceIdFn } from "~/asset-authoring/fn/readEditorAssetResourceIdFn";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { ProjectOperationError } from "~/project-authoring/error/ProjectOperationError";

export type EditorAssetFileInput = File;

/** Admits one browser file as a bounded Editor PNG resource. */
export const validateEditorAssetFileFx = Effect.fn("validateEditorAssetFileFx")(function* (
	inputFile: EditorAssetFileInput,
	resourceIdOverride?: string,
) {
	if (
		!inputFile.name.toLowerCase().endsWith(".png") ||
		inputFile.size > PngResourceLimits.maxBytes
	) {
		return yield* Effect.fail(
			new ProjectOperationError({
				reason: "invalid-asset",
				message: `Asset ${inputFile.name} must be a PNG no larger than ${PngResourceLimits.maxBytes} bytes.`,
			}),
		);
	}
	const projectedResourceId = resourceIdOverride ?? readEditorAssetResourceIdFn(inputFile.name);
	const resourceId = yield* Effect.try({
		try: () => IdSchema.parse(projectedResourceId),
		catch: (cause) =>
			new ProjectOperationError({
				reason: "invalid-resource-id",
				message: `Asset ${inputFile.name} does not produce a valid resource ID.`,
				cause,
			}),
	});
	const bitmap = yield* Effect.tryPromise({
		try: () => createImageBitmap(inputFile),
		catch: (cause) =>
			new ProjectOperationError({
				reason: "invalid-asset",
				message: `Asset ${resourceId} could not be read.`,
				cause,
			}),
	});
	try {
		if (
			bitmap.width < 1 ||
			bitmap.height < 1 ||
			bitmap.width > PngResourceLimits.maxDimension ||
			bitmap.height > PngResourceLimits.maxDimension ||
			bitmap.width * bitmap.height > PngResourceLimits.maxPixels
		)
			return yield* Effect.fail(
				new ProjectOperationError({
					reason: "invalid-asset",
					message: `Asset ${resourceId} exceeds the supported PNG dimensions.`,
				}),
			);
	} finally {
		bitmap.close();
	}
	return {
		id: resourceId,
		mime: "image/png",
		size: inputFile.size,
	} as const;
});
