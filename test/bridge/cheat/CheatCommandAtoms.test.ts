import { scheduleTask } from "@effect/atom-react";
import { Cause, Effect, Exit, Option, Result } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, describe, expect, it, vi } from "vitest";

import { setCheatEnabledAtom } from "~/bridge/cheat/setCheatEnabledAtom";
import { setInstantGameplayAtom } from "~/bridge/cheat/setInstantGameplayAtom";
import { spawnCheatItemAtom } from "~/bridge/cheat/spawnCheatItemAtom";
import type { Game } from "~/bridge/game/Game";
import { testArkpackConfig } from "~test/bridge/arkpack/support/createTestArkpack";
import { makeTestGameTransitionFieldsFx } from "~test/support/game/makeTestGameTransitionFieldsFx";
import { testGameRead } from "~test/support/game/testGameRead";

const registries: AtomRegistry.AtomRegistry[] = [];

afterEach(() => {
	for (const registry of registries.splice(0)) registry.dispose();
});

const makeRegistry = () => {
	const registry = AtomRegistry.make({
		scheduleTask,
	});
	registries.push(registry);
	return registry;
};

const createGame = (commandFx: Effect.Effect<unknown, unknown> = Effect.void): Game => ({
	arkpack: {
		packageId: "package:cheat-command",
		contentHash: "content:cheat-command",
		title: "Cheat command game",
		version: "1.0",
		arkini: "1.0",
		provenance: {
			type: "community",
		} as const,
		source: "user",
	},
	config: testArkpackConfig,
	saveKey: {
		packageId: "package:cheat-command",
	},
	disposeFx: Effect.void,
	disposeWithoutSaveFx: Effect.void,
	flushSaveFx: Effect.void,
	getResourceUrl: () => "blob:test",
	...Effect.runSync(makeTestGameTransitionFieldsFx({} as ReturnType<Game["getSnapshot"]>)),
	read: testGameRead,
	runFx: ((_effect) => commandFx) as Game["runFx"],
	run: (() => Promise.reject(new Error("Not used by this test."))) as Game["run"],
	subscribe: () => () => undefined,
	subscribeEvents: () => () => undefined,
});

const runCommand = <Value, Error, Input>(
	registry: AtomRegistry.AtomRegistry,
	atom: Atom.AtomResultFn<Input, Value, Error>,
	input: Input,
) => {
	registry.set(atom, input);
	return Effect.runPromiseExit(
		AtomRegistry.getResult(registry, atom, {
			suspendOnWaiting: true,
		}),
	);
};

describe("Cheat command atoms", () => {
	it("routes every gameplay Cheat command exclusively through the exact Game.runFx", async () => {
		const run = vi.fn();
		const game = createGame(Effect.sync(run));
		const registry = makeRegistry();

		expect(await runCommand(registry, setCheatEnabledAtom(game), true)).toEqual(
			Exit.succeed(undefined),
		);
		expect(await runCommand(registry, setInstantGameplayAtom(game), true)).toEqual(
			Exit.succeed(undefined),
		);
		expect(await runCommand(registry, spawnCheatItemAtom(game), "item:test")).toEqual(
			Exit.succeed(undefined),
		);
		expect(run).toHaveBeenCalledTimes(3);
	});

	it("uses exact Game object identity even for structurally equal Games", () => {
		const gameA = createGame();
		const gameB = {
			...gameA,
		};

		expect(setCheatEnabledAtom(gameA)).toBe(setCheatEnabledAtom(gameA));
		expect(setCheatEnabledAtom(gameA)).not.toBe(setCheatEnabledAtom(gameB));
		expect(setInstantGameplayAtom(gameA)).not.toBe(setInstantGameplayAtom(gameB));
		expect(spawnCheatItemAtom(gameA)).not.toBe(spawnCheatItemAtom(gameB));
	});

	it("preserves the command's exact typed failure", async () => {
		const failure = {
			_tag: "CheatCommandFailure",
		} as const;
		const registry = makeRegistry();

		const exit = await runCommand(
			registry,
			spawnCheatItemAtom(createGame(Effect.fail(failure))),
			"item:test",
		);

		expect(Exit.isFailure(exit)).toBe(true);
		if (Exit.isSuccess(exit)) throw new Error("Expected Cheat command failure.");
		expect(Cause.findErrorOption(exit.cause)).toEqual(Option.some(failure));
	});

	it("preserves command defects in the AsyncResult Cause", async () => {
		const defect = new Error("Cheat command defect");
		const registry = makeRegistry();

		const exit = await runCommand(
			registry,
			spawnCheatItemAtom(createGame(Effect.die(defect))),
			"item:test",
		);

		expect(Exit.isFailure(exit)).toBe(true);
		if (Exit.isSuccess(exit)) throw new Error("Expected Cheat command defect.");
		const found = Cause.findDefect(exit.cause);
		expect(Result.isSuccess(found)).toBe(true);
		if (Result.isSuccess(found)) expect(found.success).toBe(defect);
	});
});
