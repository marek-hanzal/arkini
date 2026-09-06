import { Effect } from "effect";
import sharp from "sharp";

import { PngResourceLimits } from "~/game-config-resource/constant/PngResourceLimits";
import type { ResourceSchema } from "~/game-config-resource/schema/ResourceSchema";

const pngOptions = {
	compressionLevel: 9,
	palette: false,
} as const;

const equalBytesFn = (left: Uint8Array, right: Uint8Array): boolean =>
	left.byteLength === right.byteLength && left.every((byte, index) => byte === right[index]);

export namespace optimizePngResourceFx {
	export interface Result {
		readonly changed: boolean;
		readonly originalBytes: number;
		readonly optimizedBytes: number;
		readonly resource: ResourceSchema.Type;
	}
}

/** Clears invisible RGB data and chooses the smaller lossless PNG row filter. */
export const optimizePngResourceFx = Effect.fn("optimizePngResourceFx")(
	(resource: ResourceSchema.Type) =>
		Effect.tryPromise({
			try: async (): Promise<optimizePngResourceFx.Result> => {
				if (resource.bytes.byteLength > PngResourceLimits.maxBytes)
					throw new Error(`Resource ${resource.id} exceeds the PNG byte limit.`);
				const image = sharp(resource.bytes, {
					limitInputPixels: PngResourceLimits.maxPixels,
				});
				const metadata = await image.metadata();
				if (
					metadata.format !== "png" ||
					metadata.depth !== "uchar" ||
					metadata.width === undefined ||
					metadata.height === undefined ||
					metadata.width < 1 ||
					metadata.height < 1 ||
					metadata.width > PngResourceLimits.maxDimension ||
					metadata.height > PngResourceLimits.maxDimension ||
					metadata.width * metadata.height > PngResourceLimits.maxPixels
				)
					throw new Error(`Resource ${resource.id} must be a supported 8-bit PNG image.`);

				const { data, info } = await image
					.toColourspace("srgb")
					.ensureAlpha()
					.raw({
						depth: "uchar",
					})
					.toBuffer({
						resolveWithObject: true,
					});
				if (
					info.width !== metadata.width ||
					info.height !== metadata.height ||
					info.channels !== 4
				)
					throw new Error(`Resource ${resource.id} could not be normalized as RGBA.`);

				for (let offset = 0; offset < data.byteLength; offset += 4) {
					if (
						data[offset + 3] === 0 &&
						(data[offset] !== 0 || data[offset + 1] !== 0 || data[offset + 2] !== 0)
					) {
						data[offset] = 0;
						data[offset + 1] = 0;
						data[offset + 2] = 0;
					}
				}

				const encodeFn = (adaptiveFiltering: boolean) =>
					sharp(data, {
						raw: {
							channels: 4,
							height: info.height,
							width: info.width,
						},
					})
						.png({
							...pngOptions,
							adaptiveFiltering,
						})
						.toBuffer();
				const [adaptive, nonAdaptive] = await Promise.all([
					encodeFn(true),
					encodeFn(false),
				]);
				const candidate =
					adaptive.byteLength <= nonAdaptive.byteLength ? adaptive : nonAdaptive;
				if (candidate.byteLength > PngResourceLimits.maxBytes)
					throw new Error(
						`Resource ${resource.id} exceeds the PNG byte limit after optimization.`,
					);
				const optimized = new Uint8Array(candidate);
				const changed = !equalBytesFn(resource.bytes, optimized);
				return {
					changed,
					originalBytes: resource.bytes.byteLength,
					optimizedBytes: optimized.byteLength,
					resource: !changed
						? resource
						: {
								...resource,
								bytes: optimized,
							},
				};
			},
			catch: (cause) =>
				new Error(`Resource ${resource.id} could not be optimized.`, {
					cause,
				}),
		}),
);
