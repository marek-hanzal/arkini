import { describe, expect, it } from "vitest";
import { decodeArkiniPack, encodeArkiniPack } from "~/config/pack/ArkiniPackFormat";

describe("ArkiniPackFormat", () => {
	it("round-trips MessagePack config and raw resource bytes", () => {
		const bytes = encodeArkiniPack({
			config: {
				version: 1,
				kept: true,
				removed: undefined,
			},
			resources: [
				{
					id: "resource:test",
					mime: "image/png",
					bytes: new Uint8Array([
						1,
						2,
						3,
					]),
				},
			],
		});

		const decoded = decodeArkiniPack(bytes);

		expect(decoded.config).toEqual({
			version: 1,
			kept: true,
		});
		expect(decoded.resources).toEqual([
			{
				id: "resource:test",
				mime: "image/png",
				bytes: new Uint8Array([
					1,
					2,
					3,
				]),
			},
		]);
	});

	it("rejects non-Arkini bytes", () => {
		expect(() =>
			decodeArkiniPack(
				new Uint8Array([
					0,
					1,
					2,
				]),
			),
		).toThrow("truncated header");
	});
});
