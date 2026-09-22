import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { readOutputPlacementItemEventsFx } from "~/game-event/fx/readOutputPlacementItemEventsFx";
import type { applyOutputPlacementFx } from "~/item-placement/fx/applyOutputPlacementFx";
import { createJobTestConfig } from "~test/production-job/support/jobTestConfig";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";

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
}: {
	id: string;
	itemId: "water" | "tool";
	location: ReturnType<typeof board>;
}) => ({
	id,
	item: config.items[itemId],
	location,
	revision: `revision:${id}`,
});

describe("readOutputPlacementItemEventsFx", () => {
	it("reports exact spawned identities in placement order", () => {
		const first = item({
			id: "runtime:first",
			itemId: "water",
			location: board(0),
		});
		const spawned = item({
			id: "runtime:spawned",
			itemId: "water",
			location: board(1),
		});
		const placement = {
			drop: [
				{
					drop: {
						itemId: "water",
						quantity: 2,
						placement: "drop",
					},
					placement: {
						remove: [],
						spawn: [
							first,
							spawned,
						],
					},
				},
			],
		} satisfies applyOutputPlacementFx.Result;

		expect(
			Effect.runSync(
				readOutputPlacementItemEventsFx({
					originItemId: "runtime:origin",
					placement,
				}),
			),
		).toEqual([
			{
				type: GameEventEnumSchema.enum.ItemSpawned,
				itemId: first.id,
				canonicalItemId: "water",
				originItemId: "runtime:origin",
				location: first.location,
			},
			{
				type: GameEventEnumSchema.enum.ItemSpawned,
				itemId: spawned.id,
				canonicalItemId: "water",
				originItemId: "runtime:origin",
				location: spawned.location,
			},
		]);
	});
});
