import { scheduleTask } from "@effect/atom-react";
import { Cause, Deferred, Effect } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Game } from "~/installed-game/type/Game";
import { TileDefaultLineCommandAtom } from "~/tile-interaction/atom/TileDefaultLineCommandAtom";

const engineCommands = vi.hoisted(() => ({
	enqueue: vi.fn(),
	fill: vi.fn(),
}));
const failStop = vi.fn<Game["failStopFn"]>();

vi.mock("~/production-job/fx/enqueueDefaultLineFx", () => ({
	enqueueDefaultLineFx: (props: unknown) => engineCommands.enqueue(props),
}));
vi.mock("~/production-job/fx/fillDefaultLineQueueFx", () => ({
	fillDefaultLineQueueFx: (props: unknown) => engineCommands.fill(props),
}));

const command = {
	kind: "enqueue",
	ownerItemId: "runtime:producer",
} as const;

const registries: AtomRegistry.AtomRegistry[] = [];

const createRegistry = () => {
	const registry = AtomRegistry.make({
		scheduleTask,
	});
	registries.push(registry);
	return registry;
};

const game = {
	failStopFn: failStop,
	runFx: ((effect: Effect.Effect<unknown, unknown>) => effect) as Game["runFx"],
} as unknown as Game;

const runCommand = async () => {
	const registry = createRegistry();
	const atom = TileDefaultLineCommandAtom(game);
	const unmount = registry.mount(atom);
	registry.set(atom, command);
	await vi.waitFor(() => expect(engineCommands.enqueue).toHaveBeenCalledOnce());
	return {
		atom,
		registry,
		unmount,
	};
};

beforeEach(() => {
	engineCommands.enqueue.mockReset();
	engineCommands.fill.mockReset();
	failStop.mockReset();
});

afterEach(() => {
	for (const registry of registries.splice(0)) registry.dispose();
});

describe("TileDefaultLineCommandAtom", () => {
	it("coalesces a rage-click burst while another owner remains independent", async () => {
		const staleFailure = {
			_tag: "StaleMissingInputs",
		} as const;
		const firstGate = Effect.runSync(Deferred.make<never, typeof staleFailure>());
		engineCommands.enqueue.mockReturnValueOnce(Deferred.await(firstGate)).mockReturnValueOnce(
			Effect.succeed({
				id: "request:other",
			}),
		);
		const registry = createRegistry();
		const atom = TileDefaultLineCommandAtom(game);
		const unmount = registry.mount(atom);

		registry.set(atom, command);
		await vi.waitFor(() => expect(engineCommands.enqueue).toHaveBeenCalledOnce());
		for (let click = 0; click < 100; click += 1) registry.set(atom, command);
		await Promise.resolve();
		expect(engineCommands.enqueue).toHaveBeenCalledOnce();
		registry.set(atom, {
			...command,
			ownerItemId: "runtime:other-producer",
		});
		await vi.waitFor(() => expect(engineCommands.enqueue).toHaveBeenCalledTimes(2));
		await vi.waitFor(() =>
			expect(registry.get(atom)).toEqual({
				kind: "idle",
			}),
		);

		Effect.runSync(Deferred.fail(firstGate, staleFailure));
		await Promise.resolve();
		await Promise.resolve();
		expect(registry.get(atom)).toEqual({
			kind: "idle",
		});
		unmount();
	});

	it("admits the same intent again after its previous engine command settles", async () => {
		engineCommands.enqueue.mockReturnValue(
			Effect.succeed({
				id: "request:accepted",
			}),
		);
		const registry = createRegistry();
		const atom = TileDefaultLineCommandAtom(game);
		const unmount = registry.mount(atom);

		registry.set(atom, command);
		await vi.waitFor(() => expect(engineCommands.enqueue).toHaveBeenCalledOnce());
		await vi.waitFor(() =>
			expect(registry.get(atom)).toEqual({
				kind: "idle",
			}),
		);
		await Promise.resolve();
		registry.set(atom, command);

		await vi.waitFor(() => expect(engineCommands.enqueue).toHaveBeenCalledTimes(2));
		unmount();
	});

	it("treats Provider teardown interruption as cancellation without fail-stopping the Game", async () => {
		const entered = Effect.runSync(Deferred.make<void>());
		const interrupted = Effect.runSync(Deferred.make<void>());
		engineCommands.enqueue.mockReturnValue(
			Deferred.succeed(entered, undefined).pipe(
				Effect.andThen(Effect.never),
				Effect.onInterrupt(() =>
					Deferred.succeed(interrupted, undefined).pipe(Effect.asVoid),
				),
			),
		);
		const registry = createRegistry();
		const atom = TileDefaultLineCommandAtom(game);
		const unmount = registry.mount(atom);
		registry.set(atom, command);
		await Effect.runPromise(Deferred.await(entered));

		unmount();
		await Effect.runPromise(Deferred.await(interrupted));

		expect(failStop).not.toHaveBeenCalled();
	});

	it("settles one accepted Enqueue without invoking immediate work", async () => {
		engineCommands.enqueue.mockReturnValue(
			Effect.succeed({
				id: "request:accepted",
			}),
		);

		const { atom, registry, unmount } = await runCommand();

		await vi.waitFor(() => {
			expect(registry.get(atom)).toEqual({
				kind: "idle",
			});
		});
		expect(engineCommands.enqueue).toHaveBeenCalledWith({
			ownerItemId: command.ownerItemId,
		});
		unmount();
	});

	it("routes one fill command and excludes another action for the same unsettled owner", async () => {
		const gate = Effect.runSync(Deferred.make<void>());
		engineCommands.fill.mockReturnValue(
			Deferred.await(gate).pipe(
				Effect.as({
					added: [],
					capacity: 5,
					lineId: "line:producer",
					used: 5,
				}),
			),
		);
		const registry = createRegistry();
		const atom = TileDefaultLineCommandAtom(game);
		const unmount = registry.mount(atom);

		registry.set(atom, {
			kind: "fill",
			ownerItemId: command.ownerItemId,
		});
		await vi.waitFor(() => expect(engineCommands.fill).toHaveBeenCalledOnce());
		registry.set(atom, command);
		await Promise.resolve();

		expect(engineCommands.fill).toHaveBeenCalledWith({
			ownerItemId: command.ownerItemId,
		});
		expect(engineCommands.enqueue).not.toHaveBeenCalled();
		Effect.runSync(Deferred.succeed(gate, undefined));
		await vi.waitFor(() =>
			expect(registry.get(atom)).toEqual({
				kind: "idle",
			}),
		);
		unmount();
	});

	it("projects one rejected Enqueue as a recoverable tile command error", async () => {
		const failure = {
			_tag: "JobQueueFullError",
		} as const;
		engineCommands.enqueue.mockReturnValue(Effect.fail(failure));

		const { atom, registry, unmount } = await runCommand();

		await vi.waitFor(() => {
			expect(registry.get(atom)).toEqual({
				kind: "error",
				error: failure,
				ownerItemId: command.ownerItemId,
			});
		});
		expect(failStop).not.toHaveBeenCalled();
		unmount();
	});

	it("propagates an Enqueue defect instead of flattening it", async () => {
		const defectCause = Cause.die(new Error("Enqueue defect"));
		engineCommands.enqueue.mockReturnValue(Effect.failCause(defectCause));

		await expect(runCommand()).rejects.toBe(defectCause);
		expect(failStop).toHaveBeenCalledOnce();
		expect(failStop).toHaveBeenCalledWith("ui", defectCause);
	});

	it("propagates a mixed Enqueue Cause instead of projecting its typed failure", async () => {
		const mixedCause = Cause.combine(
			Cause.fail({
				_tag: "MissingInputs",
			} as const),
			Cause.die(new Error("Enqueue defect")),
		);
		engineCommands.enqueue.mockReturnValue(Effect.failCause(mixedCause));

		await expect(runCommand()).rejects.toBe(mixedCause);
		expect(failStop).toHaveBeenCalledOnce();
		expect(failStop).toHaveBeenCalledWith("ui", mixedCause);
	});
});
