import { describe, expect, it } from "vitest";

import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";
import { JobStatusEnumSchema } from "~/engine/job/schema/read/JobStatusEnumSchema";
import { readPixiTileActorCrowdAlpha } from "~/ui/pixi/actor/readPixiTileActorCrowdAlpha";

const item = (overrides: Partial<TileActorItem> = {}): TileActorItem => ({
	compositeUrl: undefined,
	id: "runtime:item",
	itemId: "item:test",
	itemType: ItemEnumSchema.enum.Simple,
	location: {
		scope: "board",
		space: 0,
		position: {
			x: 0,
			y: 0,
		},
	},
	primaryAction: {
		kind: "none",
	},
	quantity: 1,
	revision: "revision:item",
	running: false,
	runningGlow: false,
	sourceUrl: "resource:test",
	title: "Test",
	...overrides,
});

describe("readPixiTileActorCrowdAlpha", () => {
	it.each([
		JobStatusEnumSchema.enum.Paused,
		JobStatusEnumSchema.enum.Running,
		JobStatusEnumSchema.enum.AwaitingOutput,
	])("dims an active craft in %s state", (jobStatus) => {
		expect(
			readPixiTileActorCrowdAlpha(
				item({
					itemType: ItemEnumSchema.enum.Craft,
					jobStatus,
					running: jobStatus === JobStatusEnumSchema.enum.Running,
				}),
			),
		).toBe(0.6);
	});

	it("keeps the existing running treatment for other line owners", () => {
		expect(
			readPixiTileActorCrowdAlpha(
				item({
					itemType: ItemEnumSchema.enum.Producer,
					jobStatus: JobStatusEnumSchema.enum.Running,
					running: true,
				}),
			),
		).toBe(0.82);
	});

	it("keeps an idle craft fully opaque", () => {
		expect(
			readPixiTileActorCrowdAlpha(
				item({
					itemType: ItemEnumSchema.enum.Craft,
				}),
			),
		).toBe(1);
	});
});
