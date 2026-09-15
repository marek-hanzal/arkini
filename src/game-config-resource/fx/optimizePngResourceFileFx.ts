import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { Effect } from "effect";
import sharp from "sharp";

import { PngResourceLimits } from "~/game-config-resource/constant/PngResourceLimits";

const pngOptions = {
	compressionLevel: 9,
	palette: false,
} as const;

const hashFileFn = async (path: string) => {
	const hash = createHash("sha256");
	for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer);
	return hash.digest("hex");
};

const createTransparentRgbCleanerFn = () => {
	let remainder = Buffer.alloc(0);
	return new Transform({
		transform(chunk: Buffer, _encoding, callback) {
			const body =
				remainder.byteLength === 0
					? chunk
					: Buffer.concat([
							remainder,
							chunk,
						]);
			const completeLength = body.byteLength - (body.byteLength % 4);
			for (let offset = 0; offset < completeLength; offset += 4) {
				if (body[offset + 3] === 0) {
					body[offset] = 0;
					body[offset + 1] = 0;
					body[offset + 2] = 0;
				}
			}
			if (completeLength > 0) this.push(body.subarray(0, completeLength));
			remainder = Buffer.from(body.subarray(completeLength));
			callback();
		},
		flush(callback) {
			callback(
				remainder.byteLength === 0
					? undefined
					: new Error("RGBA stream ended with an incomplete pixel."),
			);
		},
	});
};

export namespace optimizePngResourceFileFx {
	export interface Result {
		readonly changed: boolean;
		readonly originalBytes: number;
		readonly optimizedBytes: number;
		readonly path: string;
	}
}

/** Losslessly optimizes one PNG through temporary files without retaining its body. */
export const optimizePngResourceFileFx = Effect.fn("optimizePngResourceFileFx")(
	(source: string, targetPrefix: string, resourceId: string) =>
		Effect.tryPromise({
			try: async (): Promise<optimizePngResourceFileFx.Result> => {
				const sourceInfo = await stat(source);
				if (sourceInfo.size > PngResourceLimits.maxBytes)
					throw new Error(`Resource ${resourceId} exceeds the PNG byte limit.`);
				const metadata = await sharp(source, {
					limitInputPixels: PngResourceLimits.maxPixels,
				}).metadata();
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
					throw new Error(`Resource ${resourceId} must be a supported 8-bit PNG image.`);

				const rawPath = `${targetPrefix}.rgba`;
				await pipeline(
					sharp(source, {
						limitInputPixels: PngResourceLimits.maxPixels,
					})
						.toColourspace("srgb")
						.ensureAlpha()
						.raw({
							depth: "uchar",
						}),
					createTransparentRgbCleanerFn(),
					createWriteStream(rawPath, {
						flags: "wx",
					}),
				);

				const encodeFn = async (adaptiveFiltering: boolean) => {
					const target = `${targetPrefix}.${adaptiveFiltering ? "adaptive" : "plain"}.png`;
					const encoder = sharp({
						raw: {
							channels: 4,
							height: metadata.height!,
							width: metadata.width!,
						},
					}).png({
						...pngOptions,
						adaptiveFiltering,
					});
					await pipeline(
						createReadStream(rawPath),
						encoder,
						createWriteStream(target, {
							flags: "wx",
						}),
					);
					return {
						path: target,
						size: Number((await stat(target)).size),
					};
				};
				const adaptive = await encodeFn(true);
				const plain = await encodeFn(false);
				const optimized = adaptive.size <= plain.size ? adaptive : plain;
				if (optimized.size > PngResourceLimits.maxBytes)
					throw new Error(
						`Resource ${resourceId} exceeds the PNG byte limit after optimization.`,
					);
				const changed =
					sourceInfo.size !== optimized.size ||
					(await hashFileFn(source)) !== (await hashFileFn(optimized.path));
				return {
					changed,
					originalBytes: Number(sourceInfo.size),
					optimizedBytes: optimized.size,
					path: optimized.path,
				};
			},
			catch: (cause) =>
				new Error(`Resource ${resourceId} could not be optimized.`, {
					cause,
				}),
		}),
);
