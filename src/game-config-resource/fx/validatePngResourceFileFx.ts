import { stat } from "node:fs/promises";
import { Effect } from "effect";
import sharp from "sharp";

import { PngResourceLimits } from "~/game-config-resource/constant/PngResourceLimits";

/** Validates one extracted PNG without materializing its compressed body in JavaScript memory. */
export const validatePngResourceFileFx = Effect.fn("validatePngResourceFileFx")(
	(path: string, resourceId: string) =>
		Effect.tryPromise({
			try: async () => {
				const file = await stat(path);
				if (file.size < 24 || file.size > PngResourceLimits.maxBytes)
					throw new Error(`Resource ${resourceId} must be a valid bounded PNG image.`);
				const metadata = await sharp(path).metadata();
				const { format, height, width } = metadata;
				if (format !== "png" || width === undefined || height === undefined)
					throw new Error(`Resource ${resourceId} must decode as a valid PNG image.`);
				if (
					width < 1 ||
					height < 1 ||
					width > PngResourceLimits.maxDimension ||
					height > PngResourceLimits.maxDimension ||
					width * height > PngResourceLimits.maxPixels
				)
					throw new Error(`Resource ${resourceId} exceeds the supported PNG dimensions.`);
			},
			catch: (cause) =>
				cause instanceof Error && cause.message.startsWith(`Resource ${resourceId}`)
					? cause
					: new Error(`Resource ${resourceId} must decode as a valid PNG image.`, {
							cause,
						}),
		}),
);
