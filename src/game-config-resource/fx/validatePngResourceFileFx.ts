import { stat } from "node:fs/promises";
import { Effect } from "effect";
import sharp from "sharp";

import { PngResourceLimits } from "~/game-config-resource/constant/PngResourceLimits";

/** Validates one extracted PNG without materializing its compressed body in JavaScript memory. */
export const validatePngResourceFileFx = Effect.fn("validatePngResourceFileFx")(
	(path: string, resourceUid: string) =>
		Effect.tryPromise({
			try: async () => {
				const file = await stat(path);
				if (file.size < 24 || file.size > PngResourceLimits.maxBytes)
					throw new Error(`Resource ${resourceUid} must be a valid bounded PNG image.`);
				const metadata = await sharp(path).metadata();
				const { format, height, width } = metadata;
				if (format !== "png" || width === undefined || height === undefined)
					throw new Error(`Resource ${resourceUid} must decode as a valid PNG image.`);
				if (
					width < 1 ||
					height < 1 ||
					width > PngResourceLimits.maxDimension ||
					height > PngResourceLimits.maxDimension ||
					width * height > PngResourceLimits.maxPixels
				)
					throw new Error(
						`Resource ${resourceUid} exceeds the supported PNG dimensions.`,
					);
				// Metadata alone does not decode IDAT; stats forces pixel admission without returning a pixel buffer.
				await sharp(path).stats();
				return Number(file.size);
			},
			catch: (cause) =>
				cause instanceof Error && cause.message.startsWith(`Resource ${resourceUid}`)
					? cause
					: new Error(`Resource ${resourceUid} must decode as a valid PNG image.`, {
							cause,
						}),
		}),
);
