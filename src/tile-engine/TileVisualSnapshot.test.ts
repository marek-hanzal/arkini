import { describe, expect, it } from "vitest";
import { readTransformTranslate } from "~/tile-engine/TileVisualSnapshot";

describe("readTransformTranslate", () => {
	it("reads no transform as zero translate", () => {
		expect(readTransformTranslate("none")).toEqual({
			x: 0,
			y: 0,
		});
	});

	it("reads matrix translate", () => {
		expect(readTransformTranslate("matrix(1, 0, 0, 1, 12.5, -8)")).toEqual({
			x: 12.5,
			y: -8,
		});
	});

	it("reads matrix3d translate", () => {
		expect(
			readTransformTranslate("matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 7, 9, 0, 1)"),
		).toEqual({
			x: 7,
			y: 9,
		});
	});
});
