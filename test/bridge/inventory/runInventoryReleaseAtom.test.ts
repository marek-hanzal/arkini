import { scheduleTask } from "@effect/atom-react";
import { Deferred, Effect, Exit } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { GameEngine } from "~/bridge/game/GameEngine";
import { runInventoryReleaseAtom } from "~/bridge/inventory/runInventoryReleaseAtom";

const command: runInventoryReleaseAtom.Command = {
	itemId: "runtime:inventory",
	location: {
		scope: "inventory",
		position: {
			x: 1,
			y: 2,
		},
	},
	revision: "revision:inventory",
};

const registries: AtomRegistry.AtomRegistry[] = [];

afterEach(() => {
	for (const registry of registries.splice(0)) registry.dispose();
});

describe("runInventoryReleaseAtom", () => {
	it("keeps an earlier release alive when another item is clicked immediately", async () => {
		const firstGate = Effect.runSync(Deferred.make<void>());
		const firstEntered = vi.fn();
		const firstInterrupted = vi.fn();
		const firstOutcome = {
			transition: "first-released",
		};
		const secondOutcome = {
			transition: "second-released",
		};
		const runEngineFx = vi
			.fn()
			.mockReturnValueOnce(
				Effect.sync(firstEntered).pipe(
					Effect.andThen(Deferred.await(firstGate)),
					Effect.as(firstOutcome),
					Effect.onInterrupt(() => Effect.sync(firstInterrupted)),
				),
			)
			.mockReturnValueOnce(Effect.succeed(secondOutcome));
		const game = {
			runEngineFx,
		} as unknown as GameEngine;
		const registry = AtomRegistry.make({
			scheduleTask,
		});
		registries.push(registry);
		const atom = runInventoryReleaseAtom(game);
		const unmount = registry.mount(atom);

		registry.set(atom, command);
		await vi.waitFor(() => expect(firstEntered).toHaveBeenCalledOnce());
		registry.set(atom, {
			...command,
			itemId: "runtime:second-inventory",
			revision: "revision:second-inventory",
		});
		await vi.waitFor(() => expect(runEngineFx).toHaveBeenCalledTimes(2));
		expect(firstInterrupted).not.toHaveBeenCalled();

		Effect.runSync(Deferred.succeed(firstGate, undefined));
		const exit = await Effect.runPromiseExit(
			AtomRegistry.getResult(registry, atom, {
				suspendOnWaiting: true,
			}),
		);
		expect(Exit.isSuccess(exit)).toBe(true);
		expect(firstInterrupted).not.toHaveBeenCalled();
		unmount();
	});

	it("preserves the exact Game command result and isolates Game identity", async () => {
		const outcome = {
			transition: "released",
		};
		const runEngineFx = vi.fn(() => Effect.succeed(outcome));
		const first = {
			runEngineFx,
		} as unknown as GameEngine;
		const second = {
			runEngineFx,
		} as unknown as GameEngine;
		const registry = AtomRegistry.make({
			scheduleTask,
		});
		registries.push(registry);
		const atom = runInventoryReleaseAtom(first);
		const unmount = registry.mount(atom);
		registry.set(atom, command);

		const exit = await Effect.runPromiseExit(
			AtomRegistry.getResult(registry, atom, {
				suspendOnWaiting: true,
			}),
		);

		expect(exit).toEqual(Exit.succeed(outcome));
		expect(runEngineFx).toHaveBeenCalledOnce();
		expect(runInventoryReleaseAtom(first)).toBe(atom);
		expect(runInventoryReleaseAtom(second)).not.toBe(atom);
		unmount();
	});
});
