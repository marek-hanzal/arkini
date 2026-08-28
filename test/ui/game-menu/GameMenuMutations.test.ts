import { scheduleTask } from "@effect/atom-react";
import { Cause, Deferred, Effect, Exit, Option, Result } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PackageGameEngine } from "~/bridge/game/GameEngine";
import { RendererLifecycleOwnerAtom } from "~/bridge/lifecycle/RendererLifecycleOwnerAtom";
import { createRendererLifecycleFx } from "~/bridge/lifecycle/createRendererLifecycleFx";
import { requestApplicationCloseAtom } from "~/bridge/lifecycle/requestApplicationCloseAtom";
import { gameMenuCommandAtom } from "~/ui/game-menu/gameMenuCommandAtom";

const registries: AtomRegistry.AtomRegistry[] = [];
const reportCriticalFailure = vi.fn<PackageGameEngine["reportCriticalFailure"]>();

afterEach(() => {
	for (const registry of registries.splice(0)) registry.dispose();
	reportCriticalFailure.mockReset();
	vi.restoreAllMocks();
	Reflect.deleteProperty(globalThis, "window");
});

const makeRegistry = () => {
	const registry = AtomRegistry.make({
		scheduleTask,
	});
	registries.push(registry);
	return registry;
};

const createGame = (
	explicitSaveFx: Effect.Effect<void, unknown> = Effect.void,
): PackageGameEngine =>
	({
		resourceMetadata: {
			type: "package",
			packageId: "package:menu",
		},
		reportCriticalFailure,
		saveFx: explicitSaveFx,
	}) as unknown as PackageGameEngine;

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

describe("game menu command atoms", () => {
	it("runs an explicit save through the exact live Game command runtime", async () => {
		const save = vi.fn();
		const game = createGame(Effect.sync(save));
		const registry = makeRegistry();

		const exit = await runCommand(registry, gameMenuCommandAtom(game), "save");

		expect(exit).toEqual(
			Exit.succeed({
				command: "save",
				exit: Exit.succeed(undefined),
			}),
		);
		expect(save).toHaveBeenCalledOnce();
	});

	it("keeps distinct command atoms for exact Game object identities", () => {
		const gameA = createGame();
		const gameB = createGame();

		expect(gameMenuCommandAtom(gameA)).toBe(gameMenuCommandAtom(gameA));
		expect(gameMenuCommandAtom(gameA)).not.toBe(gameMenuCommandAtom(gameB));
	});

	it("preserves the explicit save typed failure", async () => {
		const failure = {
			_tag: "ExplicitSaveFailure",
		} as const;
		const game = createGame(Effect.fail(failure));
		const registry = makeRegistry();

		const exit = await runCommand(registry, gameMenuCommandAtom(game), "save");

		expect(Exit.isSuccess(exit)).toBe(true);
		if (Exit.isFailure(exit)) throw new Error("Expected a settled Game Menu result.");
		expect(exit.value.command).toBe("save");
		expect(Exit.isFailure(exit.value.exit)).toBe(true);
		if (Exit.isSuccess(exit.value.exit)) throw new Error("Expected explicit save failure.");
		expect(Cause.findErrorOption(exit.value.exit.cause)).toEqual(Option.some(failure));
	});

	it("interrupts the running save Effect when its registry owner is disposed", async () => {
		const entered = Effect.runSync(Deferred.make<void>());
		const interrupted = Effect.runSync(Deferred.make<void>());
		const game = createGame(
			Deferred.succeed(entered, undefined).pipe(
				Effect.andThen(Effect.never),
				Effect.onInterrupt(() =>
					Deferred.succeed(interrupted, undefined).pipe(Effect.asVoid),
				),
			),
		);
		const registry = makeRegistry();
		const atom = gameMenuCommandAtom(game);
		const unmount = registry.mount(atom);
		registry.set(atom, "save");
		await Effect.runPromise(Deferred.await(entered));

		unmount();
		await Effect.runPromise(Deferred.await(interrupted));

		expect(registry.getNodes().has(atom)).toBe(false);
	});

	it("replaces one Game command owner without leaking its save into the next Game", async () => {
		const firstEntered = Effect.runSync(Deferred.make<void>());
		const firstInterrupted = Effect.runSync(Deferred.make<void>());
		const secondSave = vi.fn();
		const firstGame = createGame(
			Deferred.succeed(firstEntered, undefined).pipe(
				Effect.andThen(Effect.never),
				Effect.onInterrupt(() =>
					Deferred.succeed(firstInterrupted, undefined).pipe(Effect.asVoid),
				),
			),
		);
		const secondGame = createGame(Effect.sync(secondSave));
		const registry = makeRegistry();
		const firstAtom = gameMenuCommandAtom(firstGame);
		const unmountFirst = registry.mount(firstAtom);
		registry.set(firstAtom, "save");
		await Effect.runPromise(Deferred.await(firstEntered));

		unmountFirst();
		await Effect.runPromise(Deferred.await(firstInterrupted));
		const secondExit = await runCommand(registry, gameMenuCommandAtom(secondGame), "save");

		expect(secondExit).toEqual(
			Exit.succeed({
				command: "save",
				exit: Exit.succeed(undefined),
			}),
		);
		expect(secondSave).toHaveBeenCalledOnce();
		expect(gameMenuCommandAtom(firstGame)).not.toBe(gameMenuCommandAtom(secondGame));
	});

	it("requests only the native close handshake and preserves its failure", async () => {
		const closeFailure = new Error("close rejected");
		const requestClose = vi.fn(() => Promise.reject(closeFailure));
		const registry = makeRegistry();
		registry.set(
			RendererLifecycleOwnerAtom,
			Effect.runSync(
				createRendererLifecycleFx({
					forceClose: () => undefined,
					requestClose,
					waitUntilVisible: () => Promise.resolve(0),
				}),
			),
		);

		const exit = await runCommand(registry, requestApplicationCloseAtom, undefined);

		expect(Exit.isFailure(exit)).toBe(true);
		if (Exit.isSuccess(exit)) throw new Error("Expected native close failure.");
		expect(Cause.findErrorOption(exit.cause)).toEqual(
			Option.some(
				expect.objectContaining({
					_tag: "RendererLifecycleError",
					cause: closeFailure,
					operation: "request-close",
				}),
			),
		);
		expect(requestClose).toHaveBeenCalledOnce();
	});

	it("keeps a sole typed save failure as the Game Menu's expected command result", async () => {
		const failure = {
			_tag: "ExplicitSaveFailure",
		} as const;
		const registry = makeRegistry();

		const exit = await runCommand(
			registry,
			gameMenuCommandAtom(createGame(Effect.fail(failure))),
			"save",
		);

		expect(Exit.isSuccess(exit)).toBe(true);
		if (Exit.isFailure(exit)) throw new Error("Expected a settled Game Menu result.");
		expect(exit.value.command).toBe("save");
		expect(exit.value.exit).toEqual(Exit.fail(failure));
		expect(reportCriticalFailure).not.toHaveBeenCalled();
	});

	it("propagates pure save interruption without fail-stopping the Game", async () => {
		const registry = makeRegistry();

		const exit = await runCommand(
			registry,
			gameMenuCommandAtom(createGame(Effect.interrupt)),
			"save",
		);

		expect(Exit.isFailure(exit)).toBe(true);
		if (Exit.isSuccess(exit)) throw new Error("Expected save interruption.");
		expect(Cause.hasInterruptsOnly(exit.cause)).toBe(true);
		expect(reportCriticalFailure).not.toHaveBeenCalled();
	});

	it("propagates a save defect instead of flattening it into a Game Menu error", async () => {
		const defect = new Error("Explicit save defect");
		const registry = makeRegistry();

		const exit = await runCommand(
			registry,
			gameMenuCommandAtom(createGame(Effect.die(defect))),
			"save",
		);

		expect(Exit.isFailure(exit)).toBe(true);
		if (Exit.isSuccess(exit)) throw new Error("Expected the Game Menu defect.");
		const found = Cause.findDefect(exit.cause);
		expect(Result.isSuccess(found)).toBe(true);
		if (Result.isSuccess(found)) expect(found.success).toBe(defect);
		expect(reportCriticalFailure).toHaveBeenCalledOnce();
		expect(reportCriticalFailure).toHaveBeenCalledWith("game-runtime", exit.cause);
	});

	it("propagates a mixed save Cause instead of projecting its typed failure", async () => {
		const mixedCause = Cause.combine(
			Cause.fail({
				_tag: "ExplicitSaveFailure",
			} as const),
			Cause.die(new Error("Explicit save defect")),
		);
		const registry = makeRegistry();

		const exit = await runCommand(
			registry,
			gameMenuCommandAtom(createGame(Effect.failCause(mixedCause))),
			"save",
		);

		expect(exit).toEqual(Exit.failCause(mixedCause));
		expect(reportCriticalFailure).toHaveBeenCalledOnce();
		expect(reportCriticalFailure).toHaveBeenCalledWith("game-runtime", mixedCause);
	});
});
