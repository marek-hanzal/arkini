import { readTilePaintingPngSupportFn } from "~/tile-painting/fn/readTilePaintingPngSupportFn";
import { Effect } from "effect";
import sharp from "sharp";
import { TilePaintingDocumentSchema } from "~/tile-painting/schema/TilePaintingDocumentSchema";

/** Admits embedded image bytes before recipes cross the native-to-renderer boundary. */
export const validateTilePaintingDocumentFx = Effect.fn("validateTilePaintingDocumentFx")(
	function* (candidate: unknown) {
		const document = yield* Effect.try({
			try: () => TilePaintingDocumentSchema.parse(candidate),
			catch: (cause) =>
				new Error("Painting document is invalid.", {
					cause,
				}),
		});
		for (const image of document.images) {
			yield* Effect.tryPromise({
				try: async () => {
					const bytes = Buffer.from(
						image.png.slice("data:image/png;base64,".length),
						"base64",
					);
					if (!readTilePaintingPngSupportFn(bytes))
						throw new Error(
							"Painting sources must be single-frame PNGs within the supported dimensions.",
						);
					const decoder = sharp(bytes, {
						limitInputPixels: 2048 * 2048,
					});
					const metadata = await decoder.metadata();
					if (metadata.format !== "png")
						throw new Error("Painting source must decode as PNG.");
					await decoder.raw().toBuffer();
				},
				catch: (cause) =>
					new Error(
						`Painting image ${image.label} must decode as a single-frame PNG no larger than 2048 × 2048.`,
						{
							cause,
						},
					),
			});
		}
		return document;
	},
);
