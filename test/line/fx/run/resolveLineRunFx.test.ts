import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { resolveLineRunFx } from "~/engine/line/fx/run/resolveLineRunFx";
import { RuntimeFx } from "~/engine/runtime/context/RuntimeFx";
import { lineRunRuntime } from "~test/line/fx/run/support/lineRunTestRuntime";

const resolveFx = (runtime: ReturnType<typeof lineRunRuntime>) => {
	return resolveLineRunFx({
		ownerItemId: "runtime:workshop",
		lineId: "line:workshop:build",
		runtime,
	});
};

describe("resolveLineRunFx", () => {
	it("resolves rules and exact input allocations into one ready plan", () => {
		const result = Effect.runSync(
			resolveFx(
				lineRunRuntime({
					permit: true,
					booster: true,
					water: [
						2,
						2,
					],
				}),
			),
		);

		expect(result).toMatchObject({
			show: true,
			enable: true,
			runtimeMs: 500,
			ready: true,
			input: [
				{
					resolution: {
						type: "materials",
						storedQuantity: 4,
						runQuantity: 3,
						ready: true,
					},
					plan: {
						type: "materials",
						quantity: 3,
						item: [
							{
								itemId: "runtime:water:0",
								quantity: 2,
							},
							{
								itemId: "runtime:water:1",
								quantity: 1,
							},
						],
					},
				},
				{
					resolution: {
						type: "simple",
						ready: true,
					},
					plan: {
						type: "simple",
					},
				},
			],
		});
		expect(result.plan?.input).toHaveLength(2);
	});

	it("keeps the line unplanned while one material input is missing", () => {
		const result = Effect.runSync(
			resolveFx(
				lineRunRuntime({
					permit: true,
					water: [
						2,
					],
				}),
			),
		);

		expect(result).toMatchObject({
			show: true,
			enable: true,
			ready: false,
		});
		expect(result.input[0]).toMatchObject({
			resolution: {
				missingQuantity: 1,
				ready: false,
			},
		});
		expect(result.input[0].plan).toBeUndefined();
		expect(result.plan).toBeUndefined();
	});

	it("lets active hide and disable rules veto a fully supplied line", () => {
		const result = Effect.runSync(
			resolveFx(
				lineRunRuntime({
					permit: true,
					blocker: true,
					water: [
						3,
					],
				}),
			),
		);

		expect(result).toMatchObject({
			show: false,
			enable: false,
			ready: false,
		});
		expect(result.plan).toBeUndefined();
	});

	it("forces nested rule queries to use the explicit snapshot", () => {
		const explicitRuntime = lineRunRuntime({
			water: [
				3,
			],
		});
		const conflictingOuterRuntime = lineRunRuntime({
			permit: true,
			water: [
				3,
			],
		});
		const result = Effect.runSync(
			resolveFx(explicitRuntime).pipe(
				Effect.provideService(RuntimeFx, {
					read: Effect.succeed(conflictingOuterRuntime),
				}),
			),
		);

		expect(result).toMatchObject({
			show: false,
			enable: false,
			ready: false,
		});
		expect(result.plan).toBeUndefined();
	});
});
