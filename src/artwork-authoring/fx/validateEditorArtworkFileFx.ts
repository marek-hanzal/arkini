import { Effect } from "effect";

import { PngResourceLimits } from "~/game-config-resource/constant/PngResourceLimits";
import { ProjectOperationError } from "~/project-authoring/error/ProjectOperationError";

export type EditorArtworkFileInput = File;

/** Admits one browser file as a bounded Editor PNG resource. */
export const validateEditorArtworkFileFx = Effect.fn("validateEditorArtworkFileFx")(function* (
	inputFile: EditorArtworkFileInput,
	resourceUid: string,
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
	const bitmap = yield* Effect.tryPromise({
		try: () => createImageBitmap(inputFile),
		catch: (cause) =>
			new ProjectOperationError({
				reason: "invalid-artwork",
				message: `Artwork ${resourceUid} could not be read.`,
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
					message: `Artwork ${resourceUid} must be a square PNG within the supported dimensions.`,
				}),
			);
	} finally {
		bitmap.close();
	}
	return {
		uid: resourceUid,
		type: "artwork",
		size: inputFile.size,
	} as const;
});
