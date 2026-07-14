import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { resolveInputRunFx } from "~/v1/input/fx/run/resolveInputRunFx";
import type { InputRuntimeItemSchema } from "~/v1/runtime/schema/InputRuntimeItemSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import { inputRuntimeTestConfig } from "~test/input/support/inputRuntimeTestConfig";

const workshop = inputRuntimeTestConfig.items.workshop;
if (workshop.type !== "producer") {
	throw new Error("Input runtime test workshop must remain a producer.");
}
const workshopLine = workshop.lines[0];

const owner = {
	id: "runtime:workshop",
	item: inputRuntimeTestConfig.items.workshop,
	location: {
		scope: "board",
		position: {
			x: 0,
			y: 0,
		},
	},
	quantity: 1,
	revision: "revision:owner",
} as const;

const bufferedItem = ({
	id,
	inputIndex,
	quantity,
}: {
	id: string;
	inputIndex: number;
	quantity: number;
}) => {
	return {
		id,
		item: inputRuntimeTestConfig.items.water,
		location: {
			scope: "input",
			ownerItemId: owner.id,
			lineId: "line:workshop:build",
			inputIndex,
		},
		quantity,
		revision: `revision:${id}`,
	} satisfies InputRuntimeItemSchema.Type;
};

describe("resolveInputRunFx", () => {
	it("returns the explicit empty plan for a simple input", () => {
		const result = Effect.runSync(
			resolveInputRunFx({
				input: workshopLine.input[1],
				inputIndex: 1,
				lineId: "line:workshop:build",
				ownerItemId: owner.id,
				reservedCharges: new Map(),
				runtime: {
					items: [
						owner,
					],
					jobs: [],
				},
			}),
		);

		expect(result).toEqual({
			resolution: {
				type: "simple",
				ready: true,
			},
			plan: {
				type: "simple",
			},
		});
	});

	it("plans only materials owned by the exact input slot", () => {
		const runtime = {
			items: [
				owner,
				bufferedItem({
					id: "runtime:water:a",
					inputIndex: 0,
					quantity: 2,
				}),
				bufferedItem({
					id: "runtime:water:other-slot",
					inputIndex: 1,
					quantity: 10,
				}),
				bufferedItem({
					id: "runtime:water:b",
					inputIndex: 0,
					quantity: 2,
				}),
			],
			jobs: [],
		} satisfies RuntimeSchema.Type;
		const result = Effect.runSync(
			resolveInputRunFx({
				input: workshopLine.input[0],
				inputIndex: 0,
				lineId: "line:workshop:build",
				ownerItemId: owner.id,
				reservedCharges: new Map(),
				runtime,
			}),
		);

		expect(result.resolution).toMatchObject({
			storedQuantity: 4,
			runQuantity: 3,
			ready: true,
		});
		expect(result.plan).toMatchObject({
			quantity: 3,
			item: [
				{
					itemId: "runtime:water:a",
					quantity: 2,
				},
				{
					itemId: "runtime:water:b",
					quantity: 1,
				},
			],
		});
	});

	it("resolves one charged deposit target into a charge run plan", () => {
		const target = {
			id: "runtime:stone",
			item: inputRuntimeTestConfig.items.stone,
			location: {
				scope: "board" as const,
				position: {
					x: 1,
					y: 0,
				},
			},
			quantity: 1,
			revision: "revision:stone",
		};
		const result = Effect.runSync(
			resolveInputRunFx({
				input: {
					type: "deposit",
					query: {
						scope: "board",
						selector: {
							type: "item",
							itemId: "stone",
						},
						distance: "close",
					},
					charges: {
						from: "target",
						cost: 1,
					},
				},
				inputIndex: 0,
				lineId: "line:workshop:build",
				ownerItemId: owner.id,
				reservedCharges: new Map(),
				runtime: {
					items: [
						owner,
						target,
					],
					jobs: [],
				},
			}),
		);

		expect(result).toEqual({
			resolution: {
				type: "deposit",
				ready: true,
				targetItemId: target.id,
			},
			plan: {
				type: "deposit",
				charges: {
					itemId: target.id,
					cost: 1,
				},
			},
		});
	});
});
