import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { orderStackItemsFx } from "~/v1/placement/fx/orderStackItemsFx";
import { boardLocation, placementTestConfig } from "~test/placement/fx/support/placementTestConfig";

const log = placementTestConfig.items.log;

const runtimeItem = (id: string, x: number) => {
	return {
		id,
		item: log,
		location: boardLocation(x),
		quantity: 1,
	};
};

describe("orderStackItemsFx", () => {
	it("orders board stacks by origin distance and scan-order ties", () => {
		const result = Effect.runSync(
			orderStackItemsFx({
				items: [
					runtimeItem("runtime:far", 3),
					runtimeItem("runtime:right", 2),
					runtimeItem("runtime:left", 0),
				],
				origin: {
					x: 1,
					y: 0,
				},
			}),
		);

		expect(result.map((item) => item.id)).toEqual([
			"runtime:left",
			"runtime:right",
			"runtime:far",
		]);
	});

	it("uses deterministic scan order when no origin applies", () => {
		const result = Effect.runSync(
			orderStackItemsFx({
				items: [
					runtimeItem("runtime:third", 2),
					runtimeItem("runtime:first", 0),
					runtimeItem("runtime:second", 1),
				],
			}),
		);

		expect(result.map((item) => item.id)).toEqual([
			"runtime:first",
			"runtime:second",
			"runtime:third",
		]);
	});
});
