import { describe } from "vitest";
import {
	expect,
	it,
	lineRunRuntime,
	lineRunTestConfig,
	readLines,
} from "../support/readItemDetailLinesFxFixture";

describe("readItemDetailLinesFx / delivery and autofill", () => {
	it("aggregates only outbound delivery allocations for the exact material slot", () => {
		const runtime = lineRunRuntime({
			permit: true,
		});
		const delivery = (id: string, x: number) => ({
			id,
			item: lineRunTestConfig.items.water,
			location: {
				scope: "delivery" as const,
				phase: "outbound" as const,
				generation: 0,
				remainingDurationMs: 500,
				origin: {
					scope: "board" as const,
					space: 0,
					position: {
						x,
						y: 0,
					},
				},
				target: {
					kind: "line-input" as const,
					ownerItemId: "runtime:workshop",
					lineId: "line:workshop:build",
					input: [
						{
							inputIndex: 0,
							quantity: 1,
						},
					],
				},
			},
			quantity: 1,
			revision: `revision:${id}`,
		});
		const lines = readLines({
			...runtime,
			items: [
				...runtime.items,
				delivery("runtime:delivery:first", 4),
				delivery("runtime:delivery:second", 5),
				{
					...delivery("runtime:delivery:returning", 6),
					location: {
						scope: "delivery",
						phase: "returning",
						generation: 1,
						remainingDurationMs: 500,
						origin: {
							scope: "board",
							space: 0,
							position: {
								x: 6,
								y: 0,
							},
						},
						returnFrom: {
							scope: "board",
							space: 0,
							position: {
								x: 0,
								y: 0,
							},
						},
					},
				},
			],
		});
		if (lines.kind !== "available") throw new Error("Expected available lines.");
		expect(lines.line[0]?.input[0]).toMatchObject({
			kind: "materials",
			storedQuantity: 0,
			deliveryQuantity: 2,
			autofillAvailableQuantity: 1,
			required: {
				min: 3,
				max: 3,
			},
		});
	});
	it("keeps unclaimed and returning delivery quantities available while stacks travel", () => {
		const runtime = lineRunRuntime({
			permit: true,
		});
		const outbound = {
			id: "runtime:delivery:outbound",
			item: lineRunTestConfig.items.water,
			location: {
				scope: "delivery" as const,
				phase: "outbound" as const,
				generation: 0,
				remainingDurationMs: 500,
				origin: {
					scope: "board" as const,
					space: 0,
					position: {
						x: 4,
						y: 0,
					},
				},
				target: {
					kind: "line-input" as const,
					ownerItemId: "runtime:workshop",
					lineId: "line:workshop:build",
					input: [
						{
							inputIndex: 0,
							quantity: 3,
						},
					],
				},
			},
			quantity: 7,
			revision: "revision:delivery:outbound",
		};
		const returning = {
			...outbound,
			id: "runtime:delivery:returning",
			location: {
				scope: "delivery" as const,
				phase: "returning" as const,
				generation: 1,
				remainingDurationMs: 500,
				origin: {
					scope: "toolbar" as const,
					position: {
						x: 0,
						y: 0,
					},
				},
				returnFrom: {
					scope: "board" as const,
					space: 0,
					position: {
						x: 0,
						y: 0,
					},
				},
			},
			quantity: 2,
			revision: "revision:delivery:returning",
		};
		const lines = readLines({
			...runtime,
			items: [
				...runtime.items,
				outbound,
				returning,
			],
		});
		if (lines.kind !== "available") throw new Error("Expected available lines.");
		expect(lines.line[0]?.input[0]).toMatchObject({
			kind: "materials",
			deliveryQuantity: 3,
			autofillAvailableQuantity: 6,
		});
	});
});
