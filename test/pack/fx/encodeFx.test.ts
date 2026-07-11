import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { decodeFx } from "~/v1/pack/fx/decodeFx";
import { encodeFx } from "~/v1/pack/fx/encodeFx";

describe("encodeFx", () => {
	it("round-trips MessagePack config and raw resource bytes", async () => {
		const decoded = await Effect.runPromise(
			encodeFx({
				config: {
					version: "1.0",
					kept: true,
				},
				resources: [
					{
						id: "item-log",
						mime: "image/png",
						bytes: new Uint8Array([
							1,
							2,
							3,
						]),
					},
				],
			}).pipe(Effect.flatMap(decodeFx)),
		);

		expect(decoded).toEqual({
			config: {
				version: "1.0",
				kept: true,
			},
			resources: [
				{
					id: "item-log",
					mime: "image/png",
					bytes: new Uint8Array([
						1,
						2,
						3,
					]),
				},
			],
		});
	});
});
