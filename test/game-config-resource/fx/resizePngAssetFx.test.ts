import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import sharp from "sharp";

import { resizePngAssetFx } from "~/game-config-resource/fx/resizePngAssetFx";
import { createTestPngBytes } from "~test/arkpack-support/fn/createTestPngBytes";

describe("resizePngAssetFx", () => {
	it.effect("keeps smaller artwork at its source size and emits RGBA PNG bytes", () =>
		Effect.gen(function* () {
			const resized = yield* resizePngAssetFx({
				id: "small",
				mime: "image/png",
				bytes: createTestPngBytes(),
			});
			const decoded = yield* Effect.promise(() =>
				sharp(resized.bytes).raw().toBuffer({
					resolveWithObject: true,
				}),
			);

			expect(decoded.info).toMatchObject({
				width: 1,
				height: 1,
				channels: 4,
				hasAlpha: true,
			});
		}),
	);
});
