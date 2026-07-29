import { Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";

import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import { createPixiMainSceneActorStoreFx } from "~/ui/pixi/actor/createPixiMainSceneActorStoreFx";

const board = (x: number, y: number, space = 0) =>
	({
		scope: "board",
		space,
		position: {
			x,
			y,
		},
	}) as const;

const toolbar = (x: number) =>
	({
		scope: "toolbar",
		position: {
			x,
			y: 0,
		},
	}) as const;

const item = (
	id: string,
	location: TileActorItem["location"],
	revision = `revision:${id}:1`,
): TileActorItem => ({
	activityEffect: false,
	id,
	itemId: id,
	itemType: "simple",
	location,
	primaryAction: {
		kind: "none",
	},
	quantity: 1,
	revision,
	running: false,
	sourceUrl: `resource:${id}`,
	title: id,
});

describe("Pixi main-scene canonical occupancy", () => {
	it("atomically replaces exact Board and Toolbar identities with their latest revisions", () => {
		const store = Effect.runSync(createPixiMainSceneActorStoreFx());
		const boardItem = item("runtime:board", board(2, 3));
		const toolbarItem = item("runtime:toolbar", toolbar(1));
		Effect.runSync(
			store.replaceCanonicalItemsFx([
				toolbarItem,
				boardItem,
			]),
		);

		expect(Effect.runSync(store.readCanonicalOccupantFx(board(2, 3)))).toBe(boardItem);
		expect(Effect.runSync(store.readCanonicalOccupantFx(toolbar(1)))).toBe(toolbarItem);
		expect(Effect.runSync(store.readCanonicalOccupantFx(board(3, 3)))).toBeNull();

		const revised = {
			...boardItem,
			quantity: 4,
			revision: "revision:board:2",
		};
		Effect.runSync(
			store.replaceCanonicalItemsFx([
				revised,
			]),
		);

		expect(Effect.runSync(store.readCanonicalOccupantFx(board(2, 3)))).toBe(revised);
		expect(Effect.runSync(store.readCanonicalOccupantFx(toolbar(1)))).toBeNull();
		expect(store.canonicalItems.get(boardItem.id)).toBe(revised);
	});

	it("returns unique occupants in deterministic caller slot order", () => {
		const store = Effect.runSync(createPixiMainSceneActorStoreFx());
		const first = item("runtime:first", board(1, 0));
		const second = item("runtime:second", board(2, 0));
		const tool = item("runtime:tool", toolbar(0));
		Effect.runSync(
			store.replaceCanonicalItemsFx([
				second,
				tool,
				first,
			]),
		);

		expect(
			Effect.runSync(
				store.readCanonicalOccupantsFx([
					board(1, 0),
					board(2, 0),
					board(1, 0),
					toolbar(0),
				]),
			).map(({ id }) => id),
		).toEqual([
			first.id,
			second.id,
			tool.id,
		]);
	});

	it("rejects impossible duplicate occupancy without publishing a partial replacement", () => {
		const store = Effect.runSync(createPixiMainSceneActorStoreFx());
		const retained = item("runtime:retained", board(0, 0));
		Effect.runSync(
			store.replaceCanonicalItemsFx([
				retained,
			]),
		);

		const replacement = Effect.runSync(
			Effect.exit(
				store.replaceCanonicalItemsFx([
					item("runtime:a", board(1, 0)),
					item("runtime:b", board(1, 0)),
				]),
			),
		);

		expect(Exit.isFailure(replacement)).toBe(true);
		expect(Effect.runSync(store.readCanonicalOccupantFx(board(0, 0)))).toBe(retained);
		expect(Effect.runSync(store.readCanonicalOccupantFx(board(1, 0)))).toBeNull();
		expect(Array.from(store.canonicalItems.values())).toEqual([
			retained,
		]);

		const duplicateIdentity = Effect.runSync(
			Effect.exit(
				store.replaceCanonicalItemsFx([
					item("runtime:duplicate", board(1, 0)),
					item("runtime:duplicate", toolbar(1)),
				]),
			),
		);
		expect(Exit.isFailure(duplicateIdentity)).toBe(true);
		expect(Effect.runSync(store.readCanonicalOccupantFx(board(0, 0)))).toBe(retained);
		expect(Effect.runSync(store.readCanonicalOccupantFx(board(1, 0)))).toBeNull();
		expect(Effect.runSync(store.readCanonicalOccupantFx(toolbar(1)))).toBeNull();
	});

	it("clears old-space and teardown occupancy with the canonical projection", () => {
		const store = Effect.runSync(createPixiMainSceneActorStoreFx());
		const oldSpace = item("runtime:old", board(0, 0, 0));
		const nextSpace = item("runtime:next", board(0, 0, 1));
		Effect.runSync(
			store.replaceCanonicalItemsFx([
				oldSpace,
			]),
		);
		Effect.runSync(
			store.replaceCanonicalItemsFx([
				nextSpace,
			]),
		);

		expect(Effect.runSync(store.readCanonicalOccupantFx(oldSpace.location))).toBeNull();
		expect(Effect.runSync(store.readCanonicalOccupantFx(nextSpace.location))).toBe(nextSpace);

		Effect.runSync(store.closeFx);
		Effect.runSync(
			store.replaceCanonicalItemsFx([
				oldSpace,
			]),
		);
		expect(Effect.runSync(store.readCanonicalOccupantFx(nextSpace.location))).toBeNull();
		expect(Effect.runSync(store.readCanonicalOccupantFx(oldSpace.location))).toBeNull();
		expect(store.canonicalItems.size).toBe(0);
	});
});
