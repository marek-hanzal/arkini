import { describe, expect, it } from "vitest";

import { readItemDetailIdentity } from "~/engine/item-detail/read/readItemDetailIdentity";
import { readItemDetailInfo } from "~/engine/item-detail/read/readItemDetailInfo";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { lineRunRuntime } from "~test/line/fx/run/support/lineRunTestRuntime";

describe("tile identity and Info projections", () => {
	it("separates shared shell identity from broad common item facts", () => {
		const base = lineRunRuntime({});
		const owner = base.items[0];
		if (owner === undefined) throw new Error("Missing test owner.");
		const item = {
			...owner.item,
			tags: [
				"producer",
				"era:I",
			],
			maxCount: 2,
			charges: {
				amount: 4,
			},
		};
		const runtime = {
			...base,
			items: [
				{
					...owner,
					item,
					remainingCharges: 3,
				},
				{
					...owner,
					id: "runtime:workshop:toolbar",
					item,
					location: {
						scope: "toolbar" as const,
						position: {
							x: 0,
							y: 0,
						},
					},
					revision: "revision:toolbar",
				},
			],
		} satisfies RuntimeSchema.Type;

		expect(
			readItemDetailIdentity({
				itemId: owner.id,
				runtime,
			}),
		).toMatchObject({
			kind: "available",
			itemId: owner.id,
			title: "workshop",
			categoryId: "resource",
			sourceResourceId: "asset:workshop",
		});
		expect(
			readItemDetailInfo({
				itemId: owner.id,
				runtime,
			}),
		).toEqual({
			kind: "available",
			itemId: owner.id,
			description: "workshop",
			itemType: "producer",
			categoryId: "resource",
			tags: [
				"producer",
				"era:I",
			],
			storageScope: "board",
			location: {
				kind: "board",
				space: 0,
			},
			quantity: 1,
			maxStackSize: 1,
			ownedQuantity: 2,
			maxCount: 2,
			charges: {
				remaining: 3,
				total: 4,
			},
		});
	});

	it("returns one unavailable result for a stale runtime identity", () => {
		const runtime = lineRunRuntime({});
		expect(
			readItemDetailIdentity({
				itemId: "runtime:missing",
				runtime,
			}),
		).toEqual({
			kind: "unavailable",
		});
		expect(
			readItemDetailInfo({
				itemId: "runtime:missing",
				runtime,
			}),
		).toEqual({
			kind: "unavailable",
		});
	});
});
