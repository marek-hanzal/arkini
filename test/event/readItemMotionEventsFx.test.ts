import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { readLifecycleItemEventsFx } from "~/engine/event/read/readLifecycleItemEventsFx";
import { readOutputPlacementItemEventsFx } from "~/engine/event/read/readOutputPlacementItemEventsFx";
import type { OutputPlacementResultSchema } from "~/engine/placement/schema/OutputPlacementResultSchema";
import { createJobTestConfig } from "~test/job/support/jobTestConfig";

const config = createJobTestConfig();
const board = (x: number) => ({
	scope: "board" as const,
	space: 0,
	position: {
		x,
		y: 0,
	},
});

const item = ({
	id,
	itemId,
	location,
	quantity,
}: {
	id: string;
	itemId: "water" | "tool";
	location: ReturnType<typeof board>;
	quantity: number;
}) => ({
	id,
	item: config.items[itemId],
	location,
	quantity,
	revision: `revision:${id}`,
});

describe("item motion event readers", () => {
	it("reports exact stack growth before exact spawned identities in placement order", () => {
		const stacked = item({
			id: "runtime:stacked",
			itemId: "water",
			location: board(0),
			quantity: 3,
		});
		const spawned = item({
			id: "runtime:spawned",
			itemId: "water",
			location: board(1),
			quantity: 2,
		});
		const placement = {
			drop: [
				{
					drop: {
						itemId: "water",
						quantity: 4,
						placement: "drop",
					},
					placement: {
						remove: [],
						stack: [
							{
								item: stacked,
								quantity: 2,
							},
						],
						spawn: [
							spawned,
						],
					},
				},
			],
		} satisfies OutputPlacementResultSchema.Type;

		expect(Effect.runSync(readOutputPlacementItemEventsFx(placement))).toEqual([
			{
				type: "item:stacked",
				itemId: stacked.id,
				canonicalItemId: "water",
				location: stacked.location,
				previousQuantity: 1,
				quantity: 3,
			},
			{
				type: "item:spawned",
				itemId: spawned.id,
				canonicalItemId: "water",
				location: spawned.location,
				quantity: 2,
			},
		]);
	});

	it("collapses one same-anchor spawn into a coherent replacement handoff", () => {
		const outgoing = item({
			id: "runtime:outgoing",
			itemId: "tool",
			location: board(0),
			quantity: 1,
		});
		const incoming = item({
			id: "runtime:incoming",
			itemId: "water",
			location: board(0),
			quantity: 1,
		});
		const placement = {
			drop: [
				{
					drop: {
						itemId: "water",
						quantity: 1,
						placement: "drop",
					},
					placement: {
						remove: [],
						stack: [],
						spawn: [
							incoming,
						],
					},
				},
			],
		} satisfies OutputPlacementResultSchema.Type;

		expect(
			Effect.runSync(
				readLifecycleItemEventsFx({
					outgoing,
					placement,
					reason: "lifecycle",
				}),
			),
		).toEqual([
			{
				type: "item:replaced",
				outgoingItemId: outgoing.id,
				outgoingCanonicalItemId: "tool",
				incomingItemId: incoming.id,
				incomingCanonicalItemId: "water",
				location: outgoing.location,
			},
		]);
	});
});
