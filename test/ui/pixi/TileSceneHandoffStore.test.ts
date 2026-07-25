// @vitest-environment jsdom

import { Effect } from "effect";
import { TestClock } from "effect/testing";
import { describe, expect, it } from "vitest";

import { createTileSceneHandoffStoreFx } from "~/ui/pixi/handoff/createTileSceneHandoffStoreFx";

describe("TileSceneHandoffStore", () => {
	it("transfers one route-local position at most once", async () => {
		await Effect.runPromise(
			Effect.gen(function* () {
				const store = yield* createTileSceneHandoffStoreFx();
				const handoff = {
					centerX: 120,
					centerY: 80,
					size: 48,
				};
				yield* store.writeFx("item", handoff);

				expect(yield* store.takeFx("item")).toEqual(handoff);
				expect(yield* store.takeFx("item")).toBeNull();
			}).pipe(Effect.provide(TestClock.layer())),
		);
	});

	it("drops stale and disposed cross-scene positions", async () => {
		await Effect.runPromise(
			Effect.gen(function* () {
				const store = yield* createTileSceneHandoffStoreFx();
				yield* store.writeFx("stale", {
					centerX: 1,
					centerY: 2,
					size: 3,
				});
				yield* TestClock.adjust(2_001);
				expect(yield* store.takeFx("stale")).toBeNull();

				yield* store.writeFx("closed", {
					centerX: 1,
					centerY: 2,
					size: 3,
				});
				yield* store.closeFx;
				expect(yield* store.takeFx("closed")).toBeNull();
			}).pipe(Effect.provide(TestClock.layer())),
		);
	});
});
