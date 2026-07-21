import { encode } from "@msgpack/msgpack";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { decodeArkiniSaveFx } from "~/bridge/save/decodeArkiniSaveFx";
import { encodeArkiniSaveFx } from "~/bridge/save/encodeArkiniSaveFx";
import type { StateSchema } from "~/engine/state/schema/StateSchema";

const state: StateSchema.Type = {
	cheats: {
		enabled: false,
		everEnabled: false,
		instantGameplay: false,
	},
	currentSpace: 0,
	items: [],
	jobs: [],
	jobQueue: [],
};

describe("Arkini save codec", () => {
	it("round-trips the minimal format-1 envelope", async () => {
		const bytes = await Effect.runPromise(encodeArkiniSaveFx(state));
		await expect(Effect.runPromise(decodeArkiniSaveFx(bytes))).resolves.toEqual({
			namespace: "arkini",
			format: 1,
			state,
		});
	});

	it.each([
		{
			namespace: "other",
			format: 1,
			state,
		},
		{
			namespace: "arkini",
			format: 2,
			state,
		},
		{
			namespace: "arkini",
			format: 1,
			state: {
				currentSpace: -1,
			},
		},
	])("rejects unsupported or malformed envelopes", async (value) => {
		const result = await Effect.runPromise(
			Effect.either(
				decodeArkiniSaveFx(
					encode(value, {
						ignoreUndefined: true,
					}),
				),
			),
		);
		expect(result).toMatchObject({
			_tag: "Left",
			left: {
				_tag: "ArkiniSaveDecodeError",
			},
		});
	});
});
