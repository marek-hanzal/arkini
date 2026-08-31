import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { decodeFx } from "~/arkpack-artifact/fx/decodeFx";
import { encodeFx } from "~/arkpack-artifact/fx/encodeFx";
import type { PayloadSchema } from "~/arkpack-artifact/schema/PayloadSchema";
import { ArkiniAppVersion } from "~shared/ArkiniAppMetadata";

const payload = {
	version: "1.2",
	arkini: ArkiniAppVersion,
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
} satisfies PayloadSchema.Type;

describe("encodeFx", () => {
	it("round-trips MessagePack config and raw resource bytes", async () => {
		const decoded = await Effect.runPromise(encodeFx(payload).pipe(Effect.flatMap(decodeFx)));

		expect(decoded).toEqual({
			version: "1.2",
			arkini: ArkiniAppVersion,
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

	it("rejects resources outside the fixed PNG contract", async () => {
		const invalid = {
			...payload,
			resources: [
				{
					...payload.resources[0],
					mime: "image/jpeg",
				},
			],
		} as unknown as PayloadSchema.Type;

		await expect(Effect.runPromise(encodeFx(invalid))).rejects.toThrow();
	});
});
