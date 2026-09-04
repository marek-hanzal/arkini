import { Effect } from "effect";
import sharp from "sharp";

import type { ResourceSchema } from "~/game-config-resource/schema/ResourceSchema";
import { PngResourceLimits } from "~/game-config-resource/constant/PngResourceLimits";

const maxAssetDimension = 256;

/** Produces one bounded RGBA PNG while preserving the source aspect ratio and alpha. */
export const resizePngAssetFx = Effect.fn("resizePngAssetFx")((resource: ResourceSchema.Type) =>
	Effect.tryPromise({
		try: async () => {
			if (resource.bytes.byteLength > PngResourceLimits.maxBytes) {
				throw new Error(`Asset ${resource.id} exceeds the PNG byte limit.`);
			}
			const image = sharp(resource.bytes, {
				limitInputPixels: PngResourceLimits.maxPixels,
			});
			const metadata = await image.metadata();
			if (
				metadata.format !== "png" ||
				metadata.width === undefined ||
				metadata.height === undefined ||
				metadata.width < 1 ||
				metadata.height < 1 ||
				metadata.width > PngResourceLimits.maxDimension ||
				metadata.height > PngResourceLimits.maxDimension ||
				metadata.width * metadata.height > PngResourceLimits.maxPixels
			) {
				throw new Error(`Asset ${resource.id} must decode as a PNG image.`);
			}
			const { data, info } = await image
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
				})
				.toBuffer({
					resolveWithObject: true,
				});
			if (
				info.width > maxAssetDimension ||
				info.height > maxAssetDimension ||
				info.channels !== 4
			) {
				throw new Error(`Asset ${resource.id} could not be normalized as bounded RGBA.`);
			}
			return {
				...resource,
				bytes: new Uint8Array(data),
			} satisfies ResourceSchema.Type;
		},
		catch: (cause) =>
			new Error(`Asset ${resource.id} could not be resized for the Arkpack.`, {
				cause,
			}),
	}),
);
