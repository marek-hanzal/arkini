import { encode } from "@msgpack/msgpack";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { decodeArkiniSaveFx } from "~/engine/save/fx/decodeArkiniSaveFx";
import { encodeArkiniSaveFn } from "~/engine/save/fn/encodeArkiniSaveFn";
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
const writerMajor = ArkiniAppVersion.slice(0, ArkiniAppVersion.indexOf("."));

describe("Arkini save codec", () => {
	it("round-trips arkpack and writer compatibility with canonical state", async () => {
		const bytes = encodeArkiniSaveFn({
			version: "1.2",
			state,
		});
		await expect(Effect.runPromise(decodeArkiniSaveFx(bytes))).resolves.toEqual({
			version: "1.2",
			arkini: ArkiniAppVersion,
			state,
		});
	});

	it.each([
		`${writerMajor}.0.0`,
		`${writerMajor}.999.999`,
	])("admits structurally current same-major writer %s", async (arkini) => {
		await expect(
			Effect.runPromise(
				decodeArkiniSaveFx(
					encode({
						version: "1.2",
						arkini,
						state,
					}),
				),
			),
		).resolves.toMatchObject({
			arkini,
			state,
		});
	});

	it("rejects a different writer major with a typed incompatibility", async () => {
		const arkini = `${Number(writerMajor) + 1}.0.0`;
		await expect(
			Effect.runPromise(
				decodeArkiniSaveFx(
					encode({
						version: "1.2",
						arkini,
						state,
					}),
				),
			),
		).rejects.toMatchObject({
			_tag: "ArkiniVersionIncompatibleError",
			artifact: "save",
			writerVersion: arkini,
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

		const bytes = encodeArkiniSaveFn({
			version: "1.2",
			state: queuedState,
		});
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
			encodeArkiniSaveFn({
				version: "1.2",
				state: invalidCanonicalState,
			}),
		).toThrow();
	});

	it.each([
		{
			extra: true,
			version: "1.2",
			arkini: ArkiniAppVersion,
			state,
		},
		{
			version: "1.2.3",
			arkini: ArkiniAppVersion,
			state,
		},
		{
			version: "1.2",
			arkini: "invalid",
			state,
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
