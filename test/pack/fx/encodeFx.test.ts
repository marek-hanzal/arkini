import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { decodeFx } from "~/engine/pack/fx/decodeFx";
import { encodeFx } from "~/engine/pack/fx/encodeFx";
import { ArkiniAppVersion } from "../../../shared/ArkiniAppMetadata";

describe("encodeFx", () => {
	it("round-trips MessagePack config and raw resource bytes", async () => {
		const decoded = await Effect.runPromise(
			encodeFx({
				packageId: "package:test",
				version: "1.2",
				game: ArkiniAppVersion,
				config: {
					resources: {
						hero: "hero",
					},
					meta: {
						id: "game:test",
						title: "Test",
						board: {
							width: 1,
							height: 1,
						},
						inventory: {
							width: 1,
							height: 1,
						},
					},
					start: {
						currentSpace: 0,
						board: [],
						inventory: [],
						toolbar: [],
					},
					items: {},
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
			packageId: "package:test",
			version: "1.2",
			game: ArkiniAppVersion,
			config: {
				resources: {
					hero: "hero",
				},
				meta: {
					id: "game:test",
					title: "Test",
					board: {
						width: 1,
						height: 1,
					},
					inventory: {
						width: 1,
						height: 1,
					},
				},
				start: {
					currentSpace: 0,
					board: [],
					inventory: [],
					toolbar: [],
				},
				items: {},
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
