// @vitest-environment jsdom
import { Deferred, Effect } from "effect";
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
				itemId: "first",
				quantity: 1,
				location: firstLocation,
			}),
		);
		const b = await session.runFn(
			spawnItemFx({
				id: "b",
				itemId: "second",
				quantity: 1,
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

it("keeps rejected and committed overlapping Space activations distinct", async () => {
	const { session, commands, hold, release, close } = await createSessionFixture();
	try {
		const firstLocation = {
			scope: "inventory",
			position: {
				x: 0,
				y: 0,
			},
		} as const;
		const secondLocation = {
			scope: "inventory",
			position: {
				x: 1,
				y: 0,
			},
		} as const;
		const a = await session.runFn(
			spawnItemFx({
				id: "blocked",
				itemId: "blocked",
				quantity: 1,
				location: firstLocation,
			}),
		);
		const b = await session.runFn(
			spawnItemFx({
				id: "ready",
				itemId: "ready",
				quantity: 1,
				location: secondLocation,
			}),
		);
		await hold();
		const first = commands.runSpaceActivationFn({
			currentSpace: 0,
			itemId: a.id,
			location: firstLocation,
			revision: a.revision,
		});
		const second = commands.runSpaceActivationFn({
			currentSpace: 0,
			itemId: b.id,
			location: secondLocation,
			revision: b.revision,
		});
		release();
		const results = await Promise.all([
			first,
			second,
		]);
		expect(results[0]).toBeNull();
		expect(results[1]?.transition?.runtime.currentSpace).toBe(7);
		expect(session.getSnapshotFn().currentSpace).toBe(7);
	} finally {
		await close();
	}
});

it("settles pending Inventory releases independently across exact Game replacement", async () => {
	const gate = Effect.runSync(Deferred.make<void>());
	const firstOutcome = {
		itemId: "first",
	};
	const secondOutcome = {
		itemId: "second",
	};
	const firstRun = vi
		.fn()
		.mockReturnValueOnce(Deferred.await(gate).pipe(Effect.as(firstOutcome)))
		.mockReturnValueOnce(Effect.succeed(secondOutcome));
	const secondRun = vi.fn(() =>
		Effect.succeed({
			itemId: "replacement",
		}),
	);
	const firstGame = {
		runFx: firstRun,
	} as unknown as PlayableGame;
	const secondGame = {
		runFx: secondRun,
	} as unknown as PlayableGame;
	const mounted = await mountCommands(firstGame);
	const command = {
		itemId: "first",
		revision: "revision",
		location: {
			scope: "inventory",
			position: {
				x: 0,
				y: 0,
			},
		},
	} as const;
	try {
		const original = mounted.getCommands();
		const first = original.releaseInventoryItemFn(command);
		const second = original.releaseInventoryItemFn({
			...command,
			itemId: "second",
		});
		expect(await second).toEqual(secondOutcome);
		await mounted.render(secondGame);
		expect(await mounted.getCommands().releaseInventoryItemFn(command)).toEqual({
			itemId: "replacement",
		});
		Effect.runSync(Deferred.succeed(gate, undefined));
		expect(await first).toEqual(firstOutcome);
		expect(firstRun).toHaveBeenCalledTimes(2);
		expect(secondRun).toHaveBeenCalledOnce();
	} finally {
		Effect.runSync(Deferred.succeed(gate, undefined));
		await mounted.close();
	}
});

it("keeps command rejections recoverable without swallowing defects", async () => {
	const rejection = new Error("rejection");
	const defect = new Error("defect");
	const runFx = vi
		.fn()
		.mockReturnValueOnce(Effect.fail(rejection))
		.mockReturnValueOnce(Effect.die(defect))
		.mockReturnValueOnce(Effect.fail(rejection))
		.mockReturnValueOnce(Effect.die(defect));
	const mounted = await mountCommands({
		runFx,
	} as unknown as PlayableGame);
	const command = {
		currentSpace: 0,
		itemId: "portal",
		revision: "revision",
		location: {
			scope: "inventory",
			position: {
				x: 0,
				y: 0,
			},
		},
	} as const;
	try {
		expect(await mounted.getCommands().runSpaceActivationFn(command)).toBeNull();
		await expect(mounted.getCommands().runSpaceActivationFn(command)).rejects.toBe(defect);
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
		await expect(
			mounted.getCommands().runSplitFn({
				itemId: "item",
				revision: "revision",
				location: {
					scope: "board",
					space: 0,
					position: {
						x: 0,
						y: 0,
					},
				},
			}),
		).rejects.toBe(defect);
	} finally {
		await mounted.close();
	}
});
