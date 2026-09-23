// @vitest-environment jsdom
import { Effect } from "effect";
import { beforeAll, expect, it, vi } from "vitest";
import type { PlayableGame } from "~/playable-game/type/PlayableGame";
import { validateGameConfigFx } from "~/game-config-validation/fx/validateGameConfigFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { config, createSessionFixture, mountCommands } from "./useTileCommands.test/fixture";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;
beforeAll(async () => {
	const diagnostics = await Effect.runPromise(
		validateGameConfigFx({
			config,
			provenance: {
				items: {},
			},
		}),
	);
	expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
});

it("returns each overlapping Board drop's own committed actor", async () => {
	const { session, commands, hold, release, close } = await createSessionFixture();
	try {
		const firstLocation = {
			scope: "board",
			space: 0,
			position: {
				x: 0,
				y: 0,
			},
		} as const;
		const secondLocation = {
			...firstLocation,
			position: {
				x: 1,
				y: 0,
			},
		} as const;
		const a = await session.runFn(
			spawnItemFx({
				id: "a",
				itemUid: "first",
				location: firstLocation,
			}),
		);
		const b = await session.runFn(
			spawnItemFx({
				id: "b",
				itemUid: "second",
				location: secondLocation,
			}),
		);
		await hold();
		const first = commands.runDropFn({
			sourceItemId: a.id,
			sourceLocation: firstLocation,
			sourceRevision: a.revision,
			target: {
				kind: "slot",
				location: {
					...firstLocation,
					position: {
						x: 2,
						y: 0,
					},
				},
				occupant: null,
			},
		});
		const second = commands.runDropFn({
			sourceItemId: b.id,
			sourceLocation: secondLocation,
			sourceRevision: b.revision,
			target: {
				kind: "slot",
				location: {
					...firstLocation,
					position: {
						x: 3,
						y: 0,
					},
				},
				occupant: null,
			},
		});
		release();
		const results = await Promise.all([
			first,
			second,
		]);
		expect(results[0]).toMatchObject({
			kind: "move",
			itemId: a.id,
		});
		expect(results[1]).toMatchObject({
			kind: "move",
			itemId: b.id,
		});
		expect(session.getSnapshotFn().items.find((i) => i.id === a.id)?.location).toMatchObject({
			position: {
				x: 2,
			},
		});
		expect(session.getSnapshotFn().items.find((i) => i.id === b.id)?.location).toMatchObject({
			position: {
				x: 3,
			},
		});
	} finally {
		await close();
	}
});

it("keeps command rejections recoverable without swallowing defects", async () => {
	const rejection = new Error("rejection");
	const defect = new Error("defect");
	const runFx = vi
		.fn()
		.mockReturnValueOnce(Effect.fail(rejection))
		.mockReturnValueOnce(Effect.die(defect));
	const mounted = await mountCommands({
		runFx,
	} as unknown as PlayableGame);
	try {
		await expect(
			mounted.getCommands().runDropFn({
				sourceItemId: "item",
				sourceRevision: "revision",
				sourceLocation: {
					scope: "board",
					space: 0,
					position: {
						x: 0,
						y: 0,
					},
				},
				target: {
					kind: "unsupported",
				},
			}),
		).rejects.toBe(rejection);
	} finally {
		await mounted.close();
	}
});
