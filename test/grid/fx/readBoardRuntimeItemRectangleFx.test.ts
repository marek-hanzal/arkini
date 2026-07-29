import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { readBoardItemRectangleFx } from "~/engine/grid/fx/readBoardItemRectangleFx";
import { readBoardRuntimeItemRectangleFx } from "~/engine/grid/fx/readBoardRuntimeItemRectangleFx";
import type { BoardRuntimeItemSchema } from "~/engine/runtime/schema/BoardRuntimeItemSchema";
import { placementTestConfig } from "~test/placement/fx/support/placementTestConfig";

describe("readBoardRuntimeItemRectangleFx", () => {
	it("projects a canonical item at an explicit Board anchor", () => {
		const item = {
			...placementTestConfig.items.origin,
			footprint: {
				width: 2,
				height: 3,
			},
		};
		const anchor = {
			scope: "board" as const,
			space: 2,
			position: {
				x: 4,
				y: 5,
			},
		};

		expect(
			Effect.runSync(
				readBoardItemRectangleFx({
					anchor,
					item,
				}),
			),
		).toEqual({
			anchor: anchor.position,
			footprint: item.footprint,
			space: anchor.space,
		});
	});

	it("projects the hydrated Board anchor and canonical footprint", () => {
		const item = {
			id: "runtime:origin",
			item: {
				...placementTestConfig.items.origin,
				footprint: {
					width: 3,
					height: 2,
				},
			},
			location: {
				scope: "board",
				space: 4,
				position: {
					x: 5,
					y: 6,
				},
			},
			quantity: 1,
			revision: "revision:origin",
		} satisfies BoardRuntimeItemSchema.Type;

		expect(
			Effect.runSync(
				readBoardRuntimeItemRectangleFx({
					item,
				}),
			),
		).toEqual({
			anchor: item.location.position,
			footprint: item.item.footprint,
			space: item.location.space,
		});
	});
});
