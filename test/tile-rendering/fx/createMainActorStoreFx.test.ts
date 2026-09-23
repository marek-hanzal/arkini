import { Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";

import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import { createMainActorStoreFx } from "~/tile-rendering/fx/createMainActorStoreFx";

const board = (x: number, y: number, space = 0) =>
	({
		scope: "board",
		space,
		position: {
			x,
			y,
		},
	}) as const;

const otherBoard = (x: number) =>
	({
		scope: "board",
		space: 1,
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
	id,
	itemUid: id,

	location,
	primaryAction: {
		kind: "none",
	},
	revision,
	running: false,
	artworkScale: 0.8,
	sourceUrl: `resource:${id}`,
});

describe("main canonical occupancy", () => {
	it("rejects impossible duplicate occupancy without publishing a partial replacement", () => {
		const store = Effect.runSync(createMainActorStoreFx());
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
					item("runtime:duplicate", otherBoard(1)),
				]),
			),
		);
		expect(Exit.isFailure(duplicateIdentity)).toBe(true);
		expect(Effect.runSync(store.readCanonicalOccupantFx(board(0, 0)))).toBe(retained);
		expect(Effect.runSync(store.readCanonicalOccupantFx(board(1, 0)))).toBeNull();
		expect(Effect.runSync(store.readCanonicalOccupantFx(otherBoard(1)))).toBeNull();
	});

	it("clears old-space and teardown occupancy with the canonical projection", () => {
		const store = Effect.runSync(createMainActorStoreFx());
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
