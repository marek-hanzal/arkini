// @vitest-environment jsdom
import { Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";
import { createTilePaintingImageFx } from "~/tile-painting/fx/createTilePaintingImageFx";
import sharp from "sharp";

describe("Painting image admission", () => {
	it("rejects a project PNG beyond native painting limits before it can make an unsavable draft", async () => {
		const bytes = new Uint8Array(
			await sharp({
				create: {
					width: 4096,
					height: 1,
					channels: 4,
					background: "#ff00ff",
				},
			})
				.png()
				.toBuffer(),
		);
		const result = await Effect.runPromiseExit(
			createTilePaintingImageFx({
				id: "wide",
				mime: "image/png",
				bytes,
			}),
		);
		expect(Exit.isFailure(result)).toBe(true);
	});
	it("rejects animated PNGs before referencing an Asset even when the decoder accepts their first frame", async () => {
		// Synthetic 1×1 APNG: red then green, with valid animation control and frame CRCs.
		const encoded =
			"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACGFjVEwAAAACAAAAAPONk3AAAAAaZmNUTAAAAAAAAAABAAAAAQAAAAAAAAAAAAEACgAAWn8w0AAAAA1JREFUeJxj+M/A8B8ABQAB/4mZPR0AAAAaZmNUTAAAAAEAAAABAAAAAQAAAAAAAAAAAAEACgAAwQzaBAAAABFmZEFUAAAAAnicY2D4z/AfAAQBAf9i5+mcAAAAAElFTkSuQmCC";
		const bytes = new Uint8Array(Buffer.from(encoded, "base64"));
		expect(await sharp(bytes).raw().toBuffer()).toEqual(
			Buffer.from([
				255,
				0,
				0,
				255,
			]),
		);
		await expect(
			Effect.runPromise(
				createTilePaintingImageFx({
					id: "animated",
					mime: "image/png",
					bytes,
				}),
			),
		).rejects.toThrow("single-frame");
	});
});
