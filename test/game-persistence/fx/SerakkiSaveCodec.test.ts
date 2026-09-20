import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { decodeSerakkiSaveFx } from "~/game-persistence/fx/decodeSerakkiSaveFx";
import { encodeSerakkiSaveFn } from "~/game-persistence/fn/encodeSerakkiSaveFn";
import type { StateSchema } from "~/game-persistence/schema/StateSchema";
import { SerakkiAppVersion } from "~shared/SerakkiAppMetadata";

const state: StateSchema.Type = {
	cheats: {
		enabled: false,
		everEnabled: false,
		speedUpGameplay: false,
	},
	currentSpace: 0,
	items: [],
	jobs: [],
	jobQueue: [],
};
const writerMajor = SerakkiAppVersion.slice(0, SerakkiAppVersion.indexOf("."));
const encodeJsonFn = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));

describe("Serakki save codec", () => {
	it("round-trips serapack and writer compatibility with canonical state", async () => {
		const bytes = encodeSerakkiSaveFn({
			version: "1.2",
			state,
		});
		await expect(Effect.runPromise(decodeSerakkiSaveFx(bytes))).resolves.toEqual({
			version: "1.2",
			serakki: SerakkiAppVersion,
			state,
		});
	});

	it.each([
		`${writerMajor}.0.0`,
		`${writerMajor}.999.999`,
	])("admits structurally current same-major writer %s", async (serakki) => {
		await expect(
			Effect.runPromise(
				decodeSerakkiSaveFx(
					encodeJsonFn({
						version: "1.2",
						serakki,
						state,
					}),
				),
			),
		).resolves.toMatchObject({
			serakki,
			state,
		});
	});

	it("rejects a different writer major with a typed incompatibility", async () => {
		const serakki = `${Number(writerMajor) + 1}.0.0`;
		await expect(
			Effect.runPromise(
				decodeSerakkiSaveFx(
					encodeJsonFn({
						version: "1.2",
						serakki,
						state,
					}),
				),
			),
		).rejects.toMatchObject({
			_tag: "SerakkiVersionIncompatibleError",
			artifact: "save",
			writerVersion: serakki,
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

		const bytes = encodeSerakkiSaveFn({
			version: "1.2",
			state: queuedState,
		});
		const decoded = await Effect.runPromise(decodeSerakkiSaveFx(bytes));

		expect(decoded.state.jobQueue).toEqual(queuedState.jobQueue);
		expect(decoded.state.jobQueue?.map(({ id }) => id)).toEqual([
			"job:queue:first",
			"job:queue:second",
			"job:queue:third",
		]);
	});

	it.each([
		{
			extra: true,
			version: "1.2",
			serakki: SerakkiAppVersion,
			state,
		},
		{
			version: "1.2.3",
			serakki: SerakkiAppVersion,
			state,
		},
		{
			version: "1.2",
			serakki: "invalid",
			state,
		},
	])("rejects unsupported or malformed envelopes", async (value) => {
		const result = await Effect.runPromise(
			Effect.result(decodeSerakkiSaveFx(encodeJsonFn(value))),
		);
		expect(result).toMatchObject({
			_tag: "Failure",
			failure: {
				_tag: "SerakkiSaveDecodeError",
			},
		});
	});
});
