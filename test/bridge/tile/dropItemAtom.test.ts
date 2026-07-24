import { scheduleTask } from "@effect/atom-react";
import { Cause, Deferred, Effect, Exit, Option } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Game } from "~/bridge/game/Game";
import { dropItemAtom } from "~/bridge/tile/dropItemAtom";
import { DropItemRejectedReasonEnumSchema } from "~/engine/runtime/schema/command/DropItemRejectedReasonEnumSchema";
import { DropItemResultKindEnumSchema } from "~/engine/runtime/schema/command/DropItemResultKindEnumSchema";

const props: dropItemAtom.Props = {
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

const outcome: dropItemAtom.Result = {
	kind: DropItemResultKindEnumSchema.enum.Reject,
	reason: DropItemRejectedReasonEnumSchema.enum.UnsupportedTarget,
	itemId: props.sourceItemId,
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

const createGame = (command: Effect.Effect<dropItemAtom.Result, unknown>) => {
	const runFx = vi.fn(() => command);
	return {
		game: {
			runFx,
		} as unknown as Game,
		runFx,
	};
};

const runDrop = (registry: AtomRegistry.AtomRegistry, game: Game) => {
	const atom = dropItemAtom(game);
	registry.set(atom, props);
	return Effect.runPromiseExit(
		AtomRegistry.getResult(registry, atom, {
			suspendOnWaiting: true,
		}),
	);
};

describe("dropItemAtom", () => {
	it("runs through one exact Game command runtime and preserves success", async () => {
		const { game, runFx } = createGame(Effect.succeed(outcome));
		const registry = makeRegistry();

		expect(await runDrop(registry, game)).toEqual(Exit.succeed(outcome));
		expect(runFx).toHaveBeenCalledOnce();
	});

	it("preserves typed failures and defects as distinct Causes", async () => {
		const typedFailure = {
			_tag: "DropFailure",
		} as const;
		const typedGame = createGame(Effect.fail(typedFailure)).game;
		const defect = new Error("drop defect");
		const defectiveGame = createGame(Effect.die(defect)).game;
		const registry = makeRegistry();

		const typedExit = await runDrop(registry, typedGame);
		expect(Exit.isFailure(typedExit)).toBe(true);
		if (Exit.isSuccess(typedExit)) throw new Error("Expected typed drop failure.");
		expect(Cause.findErrorOption(typedExit.cause)).toEqual(Option.some(typedFailure));
		expect(Cause.hasDies(typedExit.cause)).toBe(false);

		const defectExit = await runDrop(registry, defectiveGame);
		expect(Exit.isFailure(defectExit)).toBe(true);
		if (Exit.isSuccess(defectExit)) throw new Error("Expected drop defect.");
		expect(Cause.hasDies(defectExit.cause)).toBe(true);
		expect(Cause.findErrorOption(defectExit.cause)).toEqual(Option.none());
	});

	it("interrupts the running command when its registry mount is released", async () => {
		const entered = Effect.runSync(Deferred.make<void>());
		const interrupted = Effect.runSync(Deferred.make<void>());
		const { game } = createGame(
			Deferred.succeed(entered, undefined).pipe(
				Effect.andThen(Effect.never),
				Effect.onInterrupt(() =>
					Deferred.succeed(interrupted, undefined).pipe(Effect.asVoid),
				),
			),
		);
		const registry = makeRegistry();
		const atom = dropItemAtom(game);
		const unmount = registry.mount(atom);
		registry.set(atom, props);
		await Effect.runPromise(Deferred.await(entered));

		unmount();
		await Effect.runPromise(Deferred.await(interrupted));

		expect(registry.getNodes().has(atom)).toBe(false);
	});

	it("keeps exact Game identities isolated across replacement", async () => {
		const firstEntered = Effect.runSync(Deferred.make<void>());
		const firstInterrupted = Effect.runSync(Deferred.make<void>());
		const firstGame = createGame(
			Deferred.succeed(firstEntered, undefined).pipe(
				Effect.andThen(Effect.never),
				Effect.onInterrupt(() =>
					Deferred.succeed(firstInterrupted, undefined).pipe(Effect.asVoid),
				),
			),
		).game;
		const second = createGame(Effect.succeed(outcome));
		const registry = makeRegistry();
		const firstAtom = dropItemAtom(firstGame);
		const unmountFirst = registry.mount(firstAtom);
		registry.set(firstAtom, props);
		await Effect.runPromise(Deferred.await(firstEntered));

		unmountFirst();
		await Effect.runPromise(Deferred.await(firstInterrupted));
		const secondExit = await runDrop(registry, second.game);

		expect(dropItemAtom(firstGame)).not.toBe(dropItemAtom(second.game));
		expect(secondExit).toEqual(Exit.succeed(outcome));
		expect(second.runFx).toHaveBeenCalledOnce();
	});
});
