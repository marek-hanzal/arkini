import { scheduleTask } from "@effect/atom-react";
import { Effect, Exit } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Game } from "~/bridge/game/Game";
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
	it("preserves the exact Game command result and isolates Game identity", async () => {
		const outcome = {
			transition: "released",
		};
		const runFx = vi.fn(() => Effect.succeed(outcome));
		const first = {
			runFx,
		} as unknown as Game;
		const second = {
			runFx,
		} as unknown as Game;
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
		expect(runFx).toHaveBeenCalledOnce();
		expect(runInventoryReleaseAtom(first)).toBe(atom);
		expect(runInventoryReleaseAtom(second)).not.toBe(atom);
		unmount();
	});
});
