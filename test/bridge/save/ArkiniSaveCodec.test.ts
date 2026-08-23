import { encode } from "@msgpack/msgpack";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { decodeArkiniSaveFx } from "~/bridge/save/decodeArkiniSaveFx";
import { encodeArkiniSaveFx } from "~/bridge/save/encodeArkiniSaveFx";
import type { StateSchema } from "~/engine/state/schema/StateSchema";
import { ArkiniAppVersion } from "../../../shared/ArkiniAppMetadata";

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
	it("round-trips arkpack and writer compatibility with canonical state", async () => {
		const bytes = await Effect.runPromise(
			encodeArkiniSaveFx({
				version: "1.2",
				state,
			}),
		);
		await expect(Effect.runPromise(decodeArkiniSaveFx(bytes))).resolves.toEqual({
			namespace: "arkini",
			version: "1.2",
			game: ArkiniAppVersion,
			state,
		});
	});

	it("preserves interleaved multi-owner queue identity and global accepted order", async () => {
		const queuedState: StateSchema.Type = {
			...state,
			jobQueue: [
				{
					id: "job:queue:first",
					ownerItemId: "runtime:forge:b",
					lineId: "line:forge:run",
				},
				{
					id: "job:queue:second",
					ownerItemId: "runtime:forge:a",
					lineId: "line:forge:run",
				},
				{
					id: "job:queue:third",
					ownerItemId: "runtime:forge:b",
					lineId: "line:forge:run",
				},
			],
		};

		const bytes = await Effect.runPromise(
			encodeArkiniSaveFx({
				version: "1.2",
				state: queuedState,
			}),
		);
		const decoded = await Effect.runPromise(decodeArkiniSaveFx(bytes));

		expect(decoded.state.jobQueue).toEqual(queuedState.jobQueue);
		expect(decoded.state.jobQueue?.map(({ id }) => id)).toEqual([
			"job:queue:first",
			"job:queue:second",
			"job:queue:third",
		]);
	});

	it("keeps canonical-state encoder failures in the defect channel", () => {
		const invalidCanonicalState = {
			...state,
			currentSpace: 1n,
		} as unknown as StateSchema.Type;

		expect(() =>
			Effect.runSync(
				Effect.result(
					encodeArkiniSaveFx({
						version: "1.2",
						state: invalidCanonicalState,
					}),
				),
			),
		).toThrow();
	});

	it.each([
		{
			namespace: "other",
			version: "1.2",
			game: ArkiniAppVersion,
			state,
		},
		{
			namespace: "arkini",
			version: "1.2.3",
			game: ArkiniAppVersion,
			state,
		},
		{
			namespace: "arkini",
			version: "1.2",
			game: "0.5",
			state: {
				currentSpace: -1,
			},
		},
	])("rejects unsupported or malformed envelopes", async (value) => {
		const result = await Effect.runPromise(
			Effect.result(
				decodeArkiniSaveFx(
					encode(value, {
						ignoreUndefined: true,
					}),
				),
			),
		);
		expect(result).toMatchObject({
			_tag: "Failure",
			failure: {
				_tag: "ArkiniSaveDecodeError",
			},
		});
	});
});
