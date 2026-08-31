import { scheduleTask } from "@effect/atom-react";
import { Effect, Exit } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { GameEngine } from "~/playable-game/type/GameEngine";
import type { GameTransition } from "~/game-session/type/GameSession";
import { runSpaceActivationAtom } from "~/tile-interaction/atom/runSpaceActivationAtom";

const runtime = (currentSpace: number): GameTransition["runtime"] => ({
	cheats: {
		enabled: false,
		everEnabled: false,
		instantGameplay: false,
	},
	currentSpace,
	items: [],
	jobs: [],
	jobQueue: [],
	defaultLineByOwnerItemId: {},
});

const exactTransition = {
	sequence: 4,
	previousRuntime: runtime(0),
	runtime: runtime(2),
	events: [
		{
			type: "current-space:changed",
			previousSpace: 0,
			currentSpace: 2,
		},
	],
} satisfies GameTransition;

const laterTransition = {
	...exactTransition,
	sequence: 5,
	runtime: runtime(3),
} satisfies GameTransition;

const command = (revision: string) =>
	({
		currentSpace: 0,
		itemId: "runtime:portal",
		location: {
			scope: "inventory",
			position: {
				x: 0,
				y: 0,
			},
		},
		revision,
	}) as const;

const registries: AtomRegistry.AtomRegistry[] = [];

afterEach(() => {
	for (const registry of registries.splice(0)) registry.dispose();
});

describe("runSpaceActivationAtom", () => {
	it("preserves exact commit, accepted no-op, and rejected command as distinct results", async () => {
		const getTransitionSnapshot = vi.fn(() => laterTransition);
		const runFx = vi
			.fn()
			.mockReturnValueOnce(
				Effect.succeed({
					result: 2,
					transition: exactTransition,
				}),
			)
			.mockReturnValueOnce(
				Effect.succeed({
					result: 2,
					transition: null,
				}),
			)
			.mockReturnValueOnce(Effect.fail("space-action-unavailable"));
		const game = {
			getTransitionSnapshot,
			runFx,
		} as unknown as GameEngine;
		const registry = AtomRegistry.make({
			scheduleTask,
		});
		registries.push(registry);
		const atom = runSpaceActivationAtom(game);
		const unmount = registry.mount(atom);
		const run = async (revision: string) => {
			registry.set(atom, command(revision));
			return Effect.runPromiseExit(
				AtomRegistry.getResult(registry, atom, {
					suspendOnWaiting: true,
				}),
			);
		};

		expect(await run("revision:commit")).toEqual(
			Exit.succeed({
				transition: exactTransition,
			}),
		);
		expect(await run("revision:no-op")).toEqual(
			Exit.succeed({
				transition: null,
			}),
		);
		expect(await run("revision:rejected")).toEqual(Exit.succeed(null));
		expect(getTransitionSnapshot).not.toHaveBeenCalled();
		unmount();
	});
});
