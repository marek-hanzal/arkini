import sharp from "sharp";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { optimizePngResourceFx } from "~/game-config-resource/fx/optimizePngResourceFx";

const pixels = Uint8Array.of(240, 120, 60, 0, 12, 34, 56, 255, 90, 80, 70, 128, 0, 0, 0, 0);
const optimizedPixels = Uint8Array.of(0, 0, 0, 0, 12, 34, 56, 255, 90, 80, 70, 128, 0, 0, 0, 0);

const createDirtyPngFx = Effect.promise(() =>
	sharp(pixels, {
		raw: {
			channels: 4,
			height: 2,
			width: 2,
		},
	})
		.png({
			adaptiveFiltering: false,
			compressionLevel: 0,
			palette: false,
		})
		.toBuffer(),
);

describe("PNG resource optimization", () => {
	it("preserves dimensions and visible RGBA while clearing color below zero alpha", async () => {
		const original = await Effect.runPromise(createDirtyPngFx);
		const first = await Effect.runPromise(
			optimizePngResourceFx({
				id: "dirty",
				mime: "image/png",
				bytes: new Uint8Array(original),
			}),
		);
		const metadata = await sharp(first.resource.bytes).metadata();
		const decoded = await sharp(first.resource.bytes).ensureAlpha().raw().toBuffer();

		expect(metadata).toMatchObject({
			channels: 4,
			height: 2,
			width: 2,
		});
		expect(decoded).toEqual(Buffer.from(optimizedPixels));
		expect(first.optimizedBytes).toBeLessThan(first.originalBytes);

		const second = await Effect.runPromise(optimizePngResourceFx(first.resource));
		expect(second.resource.bytes).toEqual(first.resource.bytes);
	});
});
