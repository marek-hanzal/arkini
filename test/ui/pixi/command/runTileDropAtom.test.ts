import { scheduleTask } from "@effect/atom-react";
import { Cause, Deferred, Effect, Exit, Option } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Game } from "~/renderer/game/Game";
import { runTileDropAtom } from "~/ui/pixi/command/runTileDropAtom";
import { DropItemRejectedReason } from "~/item-interaction/type/DropItemResult";
import { DropItemResultKind } from "~/item-interaction/type/DropItemResult";

const command: runTileDropAtom.Command = {
	sourceItemId: "runtime:source",
	sourceRevision: "revision:source",
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
};

const outcome: runTileDropAtom.Result = {
	kind: DropItemResultKind.Reject,
	reason: DropItemRejectedReason.UnsupportedTarget,
	itemId: command.sourceItemId,
};

const registries: AtomRegistry.AtomRegistry[] = [];

afterEach(() => {
	for (const registry of registries.splice(0)) registry.dispose();
	vi.restoreAllMocks();
});

const makeRegistry = () => {
	const registry = AtomRegistry.make({
		scheduleTask,
	});
	registries.push(registry);
	return registry;
};

const createGame = (effect: Effect.Effect<runTileDropAtom.Result, unknown>) => {
	const runFx = vi.fn(() => effect);
	return {
		game: {
			runFx,
		} as unknown as Game,
		runFx,
	};
};

const runDrop = async (registry: AtomRegistry.AtomRegistry, game: Game) => {
	const atom = runTileDropAtom(game);
	const unmount = registry.mount(atom);
	registry.set(atom, command);
	try {
		return await Effect.runPromiseExit(
			AtomRegistry.getResult(registry, atom, {
				suspendOnWaiting: true,
			}),
		);
	} finally {
		unmount();
	}
};

describe("runTileDropAtom", () => {
	it("preserves exact Game success, typed failure and defects", async () => {
		const success = createGame(Effect.succeed(outcome));
		const typedFailure = {
			_tag: "DropFailure",
		} as const;
		const defect = new Error("drop defect");
		const registry = makeRegistry();

		expect(await runDrop(registry, success.game)).toEqual(Exit.succeed(outcome));
		expect(success.runFx).toHaveBeenCalledOnce();

		const typedExit = await runDrop(registry, createGame(Effect.fail(typedFailure)).game);
		expect(Exit.isFailure(typedExit)).toBe(true);
		if (Exit.isSuccess(typedExit)) throw new Error("Expected typed drop failure.");
		expect(Cause.findErrorOption(typedExit.cause)).toEqual(Option.some(typedFailure));
		expect(Cause.hasDies(typedExit.cause)).toBe(false);

		const defectExit = await runDrop(registry, createGame(Effect.die(defect)).game);
		expect(Exit.isFailure(defectExit)).toBe(true);
		if (Exit.isSuccess(defectExit)) throw new Error("Expected drop defect.");
		expect(Cause.hasDies(defectExit.cause)).toBe(true);
		expect(Cause.findErrorOption(defectExit.cause)).toEqual(Option.none());
	});

	it("interrupts on unmount and isolates replacement Game identity", async () => {
		const entered = Effect.runSync(Deferred.make<void>());
		const interrupted = Effect.runSync(Deferred.make<void>());
		const first = createGame(
			Deferred.succeed(entered, undefined).pipe(
				Effect.andThen(Effect.never),
				Effect.onInterrupt(() =>
					Deferred.succeed(interrupted, undefined).pipe(Effect.asVoid),
				),
			),
		);
		const registry = makeRegistry();
		const firstAtom = runTileDropAtom(first.game);
		const unmount = registry.mount(firstAtom);
		registry.set(firstAtom, command);
		await Effect.runPromise(Deferred.await(entered));

		unmount();
		await Effect.runPromise(Deferred.await(interrupted));

		const second = createGame(Effect.succeed(outcome));
		expect(runTileDropAtom(first.game)).not.toBe(runTileDropAtom(second.game));
		expect(await runDrop(registry, second.game)).toEqual(Exit.succeed(outcome));
		expect(second.runFx).toHaveBeenCalledOnce();
		expect(registry.getNodes().has(firstAtom)).toBe(false);
	});
});
