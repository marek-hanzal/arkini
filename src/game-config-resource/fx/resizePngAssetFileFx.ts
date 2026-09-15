import { createWriteStream } from "node:fs";
import { stat } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { Effect } from "effect";
import sharp from "sharp";

import { PngResourceLimits } from "~/game-config-resource/constant/PngResourceLimits";
import { validatePngResourceFileFx } from "~/game-config-resource/fx/validatePngResourceFileFx";

const maxAssetDimension = 256;

/** Streams one source PNG into a bounded normalized RGBA asset file. */
export const resizePngAssetFileFx = Effect.fn("resizePngAssetFileFx")(
	(source: string, target: string, resourceId: string) =>
		Effect.gen(function* () {
			const sourceInfo = yield* Effect.tryPromise({
				try: () => stat(source),
				catch: (cause) => cause,
			});
			if (sourceInfo.size > PngResourceLimits.maxBytes)
				return yield* Effect.fail(
					new Error(`Asset ${resourceId} exceeds the PNG byte limit.`),
				);
			yield* Effect.tryPromise({
				try: async () => {
					const metadata = await sharp(source, {
						limitInputPixels: PngResourceLimits.maxPixels,
					}).metadata();
					if (
						metadata.format !== "png" ||
						metadata.width === undefined ||
						metadata.height === undefined ||
						metadata.width < 1 ||
						metadata.height < 1 ||
						metadata.width > PngResourceLimits.maxDimension ||
						metadata.height > PngResourceLimits.maxDimension ||
						metadata.width * metadata.height > PngResourceLimits.maxPixels
					)
						throw new Error(`Asset ${resourceId} must decode as a PNG image.`);
					await pipeline(
						sharp(source, {
							limitInputPixels: PngResourceLimits.maxPixels,
						})
							.toColourspace("srgb")
							.ensureAlpha()
							.resize({
								width: maxAssetDimension,
								height: maxAssetDimension,
								fit: "inside",
								withoutEnlargement: true,
							})
							.png({
								adaptiveFiltering: true,
								compressionLevel: 9,
								palette: false,
							}),
						createWriteStream(target, {
							flags: "wx",
						}),
					);
					const output = await sharp(target).metadata();
					if (
						output.width === undefined ||
						output.height === undefined ||
						output.width > maxAssetDimension ||
						output.height > maxAssetDimension ||
						output.channels !== 4
					)
						throw new Error(
							`Asset ${resourceId} could not be normalized as bounded RGBA.`,
						);
				},
				catch: (cause) =>
					new Error(`Asset ${resourceId} could not be resized for the Arkpack.`, {
						cause,
					}),
			});
			return yield* validatePngResourceFileFx(target, resourceId);
		}),
);
