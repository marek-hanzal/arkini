import { createWriteStream } from "node:fs";
import { stat } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { Effect } from "effect";
import sharp from "sharp";

import { PngResourceLimits } from "~/game-config-resource/constant/PngResourceLimits";
import { validatePngResourceFileFx } from "~/game-config-resource/fx/validatePngResourceFileFx";

const maxArtworkDimension = 256;

/** Streams one square Artwork PNG into a bounded normalized RGBA file. */
export const normalizeArtworkPngFileFx = Effect.fn("normalizeArtworkPngFileFx")(
	(source: string, target: string, resourceId: string) =>
		Effect.gen(function* () {
			const sourceInfo = yield* Effect.tryPromise({
				try: () => stat(source),
				catch: (cause) => cause,
			});
			if (sourceInfo.size > PngResourceLimits.maxBytes)
				return yield* Effect.fail(
					new Error(`Artwork ${resourceId} exceeds the PNG byte limit.`),
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
						metadata.width !== metadata.height ||
						metadata.width > PngResourceLimits.maxDimension ||
						metadata.height > PngResourceLimits.maxDimension ||
						metadata.width * metadata.height > PngResourceLimits.maxPixels
					)
						throw new Error(`Artwork ${resourceId} must decode as a square PNG image.`);
					await pipeline(
						sharp(source, {
							limitInputPixels: PngResourceLimits.maxPixels,
						})
							.toColourspace("srgb")
							.ensureAlpha()
							.resize({
								width: maxArtworkDimension,
								height: maxArtworkDimension,
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
						output.width > maxArtworkDimension ||
						output.height > maxArtworkDimension ||
						output.width !== output.height ||
						output.channels !== 4
					)
						throw new Error(
							`Artwork ${resourceId} could not be normalized as bounded square RGBA.`,
						);
				},
				catch: (cause) =>
					new Error(`Artwork ${resourceId} could not be normalized for the Arkpack.`, {
						cause,
					}),
			});
			return yield* validatePngResourceFileFx(target, resourceId);
		}),
);
