import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { isLineInputPureFx } from "~/v1/line/fx/purity/isLineInputPureFx";
import { isLineJobPureFx } from "~/v1/line/fx/purity/isLineJobPureFx";
import { isLinePureFx } from "~/v1/line/fx/purity/isLinePureFx";
import { isLineQueuePureFx } from "~/v1/line/fx/purity/isLineQueuePureFx";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import { purityTestConfig } from "~test/line/support/purityTestConfig";

const owner = {
	id: "runtime:producer",
	item: purityTestConfig.items.producer,
	location: {
		scope: "board" as const,
		position: {
			x: 0,
			y: 0,
		},
	},
	quantity: 1,
	revision: "revision:owner",
};

const baseRuntime = {
	session: {
		speedMode: "normal" as const,
	},
	items: [
		owner,
	],
	jobs: [],
	jobQueue: [],
} satisfies RuntimeSchema.Type;

const lineProps = {
	ownerItemId: owner.id,
	lineId: "line:producer:zero",
};

describe("line purity", () => {
	it("treats an empty idle line as pure", () => {
		const result = Effect.runSync(
			isLinePureFx({
				...lineProps,
				runtime: baseRuntime,
			}),
		);

		expect(result).toBe(true);
	});

	it("identifies buffered input state independently", () => {
		const runtime = {
			...baseRuntime,
			items: [
				...baseRuntime.items,
				{
					id: "runtime:material",
					item: purityTestConfig.items.material,
					location: {
						scope: "input" as const,
						ownerItemId: owner.id,
						lineId: lineProps.lineId,
						inputIndex: 0,
					},
					quantity: 1,
					revision: "revision:material",
				},
			],
		} satisfies RuntimeSchema.Type;

		expect(
			Effect.runSync(
				isLineInputPureFx({
					...lineProps,
					runtime,
				}),
			),
		).toBe(false);
		expect(
			Effect.runSync(
				isLineJobPureFx({
					...lineProps,
					runtime,
				}),
			),
		).toBe(true);
		expect(
			Effect.runSync(
				isLineQueuePureFx({
					...lineProps,
					runtime,
				}),
			),
		).toBe(true);
		expect(
			Effect.runSync(
				isLinePureFx({
					...lineProps,
					runtime,
				}),
			),
		).toBe(false);
	});

	it("identifies active job state independently", () => {
		const runtime = {
			...baseRuntime,
			jobs: [
				{
					id: "job:active",
					ownerItemId: owner.id,
					lineId: lineProps.lineId,
					durationMs: 1_000,
					remainingMs: 1_000,
				},
			],
		} satisfies RuntimeSchema.Type;

		expect(
			Effect.runSync(
				isLineJobPureFx({
					...lineProps,
					runtime,
				}),
			),
		).toBe(false);
		expect(
			Effect.runSync(
				isLinePureFx({
					...lineProps,
					runtime,
				}),
			),
		).toBe(false);
	});

	it("identifies queued state without treating it as a closed active job", () => {
		const runtime = {
			...baseRuntime,
			jobQueue: [
				{
					id: "request:queued",
					ownerItemId: owner.id,
					lineId: lineProps.lineId,
				},
			],
		} satisfies RuntimeSchema.Type;

		expect(
			Effect.runSync(
				isLineQueuePureFx({
					...lineProps,
					runtime,
				}),
			),
		).toBe(false);
		expect(
			Effect.runSync(
				isLinePureFx({
					...lineProps,
					runtime,
				}),
			),
		).toBe(false);
	});
});
