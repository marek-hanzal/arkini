import { scheduleTask } from "@effect/atom-react";
import { Cause, Deferred, Effect } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Game } from "~/bridge/game/Game";
import { TileDefaultLineCommandAtom } from "~/bridge/tile/TileDefaultLineCommandAtom";

const engineCommands = vi.hoisted(() => ({
	autofill: vi.fn(),
	start: vi.fn(),
}));
const failStop = vi.fn<Game["failStop"]>();

vi.mock("~/engine/input/write/autofillLineInputsFx", () => ({
	autofillLineInputsFx: (props: unknown) => engineCommands.autofill(props),
}));

vi.mock("~/engine/job/write/startLineFx", () => ({
	startLineFx: (props: unknown) => engineCommands.start(props),
}));

const command = {
	kind: "start",
	lineId: "line:producer",
	ownerItemId: "runtime:producer",
} as const satisfies TileDefaultLineCommandAtom.Command;

const registries: AtomRegistry.AtomRegistry[] = [];

const createRegistry = () => {
	const registry = AtomRegistry.make({
		scheduleTask,
	});
	registries.push(registry);
	return registry;
};

const game = {
	failStop,
	runFx: ((effect: Effect.Effect<unknown, unknown>) => effect) as Game["runFx"],
} as unknown as Game;

const runCommand = async () => {
	const registry = createRegistry();
	const atom = TileDefaultLineCommandAtom(game);
	const unmount = registry.mount(atom);
	registry.set(atom, command);
	await vi.waitFor(() => expect(engineCommands.autofill).toHaveBeenCalledOnce());
	return {
		atom,
		registry,
		unmount,
	};
};

beforeEach(() => {
	engineCommands.autofill.mockReset();
	engineCommands.start.mockReset();
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
		engineCommands.autofill.mockReturnValueOnce(Deferred.await(firstGate)).mockReturnValueOnce(
			Effect.succeed({
				storedQuantity: 0,
				remainingMissingQuantity: 0,
			}),
		);
		engineCommands.start.mockReturnValue(Effect.void);
		const registry = createRegistry();
		const atom = TileDefaultLineCommandAtom(game);
		const unmount = registry.mount(atom);

		registry.set(atom, command);
		await vi.waitFor(() => expect(engineCommands.autofill).toHaveBeenCalledOnce());
		for (let click = 0; click < 100; click += 1) registry.set(atom, command);
		await Promise.resolve();
		expect(engineCommands.autofill).toHaveBeenCalledOnce();
		registry.set(atom, {
			...command,
			ownerItemId: "runtime:other-producer",
		});
		await vi.waitFor(() => expect(engineCommands.autofill).toHaveBeenCalledTimes(2));
		await vi.waitFor(() =>
			expect(registry.get(atom)).toEqual({
				kind: "idle",
			}),
		);
		expect(engineCommands.start).toHaveBeenCalledOnce();

		Effect.runSync(Deferred.fail(firstGate, staleFailure));
		await Promise.resolve();
		await Promise.resolve();
		expect(registry.get(atom)).toEqual({
			kind: "idle",
		});
		unmount();
	});

	it("admits the same intent again after its previous engine command settles", async () => {
		engineCommands.autofill.mockReturnValue(
			Effect.succeed({
				storedQuantity: 0,
				remainingMissingQuantity: 0,
			}),
		);
		engineCommands.start.mockReturnValue(Effect.void);
		const registry = createRegistry();
		const atom = TileDefaultLineCommandAtom(game);
		const unmount = registry.mount(atom);

		registry.set(atom, command);
		await vi.waitFor(() => expect(engineCommands.start).toHaveBeenCalledOnce());
		await vi.waitFor(() =>
			expect(registry.get(atom)).toEqual({
				kind: "idle",
			}),
		);
		await Promise.resolve();
		registry.set(atom, command);

		await vi.waitFor(() => expect(engineCommands.start).toHaveBeenCalledTimes(2));
		unmount();
	});

	it("treats Provider teardown interruption as cancellation without fail-stopping the Game", async () => {
		const entered = Effect.runSync(Deferred.make<void>());
		const interrupted = Effect.runSync(Deferred.make<void>());
		engineCommands.autofill.mockReturnValue(
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

	it("settles after a partial autofill without starting the line or requesting Detail fallback", async () => {
		engineCommands.autofill.mockReturnValue(
			Effect.succeed({
				storedQuantity: 2,
				remainingMissingQuantity: 1,
			}),
		);
		engineCommands.start.mockReturnValue(
			Effect.die("Start must not run after partial autofill."),
		);

		const { atom, registry, unmount } = await runCommand();

		await vi.waitFor(() => {
			expect(registry.get(atom)).toEqual({
				kind: "idle",
			});
		});
		expect(engineCommands.start).not.toHaveBeenCalled();
		unmount();
	});

	it("keeps the Detail fallback when autofill cannot move any input", async () => {
		const failure = {
			_tag: "MissingInputs",
		} as const;
		engineCommands.autofill.mockReturnValue(
			Effect.succeed({
				storedQuantity: 0,
				remainingMissingQuantity: 1,
			}),
		);
		engineCommands.start.mockReturnValue(Effect.fail(failure));

		const { atom, registry, unmount } = await runCommand();

		await vi.waitFor(() => {
			expect(registry.get(atom)).toEqual({
				kind: "error",
				autofilled: false,
				error: failure,
				ownerItemId: command.ownerItemId,
			});
		});
		expect(engineCommands.start).toHaveBeenCalledOnce();
		unmount();
	});

	it("marks a later start failure as autofilled after moving all missing material", async () => {
		const failure = {
			_tag: "DepositUnavailable",
		} as const;
		engineCommands.autofill.mockReturnValue(
			Effect.succeed({
				storedQuantity: 2,
				remainingMissingQuantity: 0,
			}),
		);
		engineCommands.start.mockReturnValue(Effect.fail(failure));

		const { atom, registry, unmount } = await runCommand();

		await vi.waitFor(() => {
			expect(registry.get(atom)).toEqual({
				kind: "error",
				autofilled: true,
				error: failure,
				ownerItemId: command.ownerItemId,
			});
		});
		expect(engineCommands.start).toHaveBeenCalledOnce();
		unmount();
	});

	it("propagates an autofill defect instead of flattening it into Detail fallback state", async () => {
		const defectCause = Cause.die(new Error("Autofill defect"));
		engineCommands.autofill.mockReturnValue(Effect.failCause(defectCause));

		await expect(runCommand()).rejects.toBe(defectCause);
		expect(failStop).toHaveBeenCalledOnce();
		expect(failStop).toHaveBeenCalledWith("ui", defectCause);
	});

	it("propagates a mixed start Cause instead of projecting its typed failure", async () => {
		const mixedCause = Cause.combine(
			Cause.fail({
				_tag: "MissingInputs",
			} as const),
			Cause.die(new Error("Start defect")),
		);
		engineCommands.autofill.mockReturnValue(
			Effect.succeed({
				storedQuantity: 0,
				remainingMissingQuantity: 0,
			}),
		);
		engineCommands.start.mockReturnValue(Effect.failCause(mixedCause));

		await expect(runCommand()).rejects.toBe(mixedCause);
		expect(failStop).toHaveBeenCalledOnce();
		expect(failStop).toHaveBeenCalledWith("ui", mixedCause);
	});
});
