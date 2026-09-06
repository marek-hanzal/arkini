import { describe, expect, it } from "vitest";

import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import { projectMotionItemFn } from "~/tile-motion/fn/projectMotionItemFn";

describe("projectMotionItemFn", () => {
	it("preserves a charged item's use count while quantity motion is delayed", () => {
		const item = {
			badgeCount: 4,
			badgeKind: "charges",
			quantity: 3,
		} as TileActorItem;

		expect(
			projectMotionItemFn(item, {
				kind: "exact",
				quantity: 1,
			}),
		).toMatchObject({
			badgeCount: 4,
			badgeKind: "charges",
			quantity: 1,
		});
	});
});
