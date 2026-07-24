// @vitest-environment jsdom

import { RegistryContext, scheduleTask } from "@effect/atom-react";
import { Cause, Deferred, Effect } from "effect";
import type { PanInfo } from "motion/react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GameEngine } from "~/bridge/game/GameEngine";
import type { dropItemAtom } from "~/bridge/tile/dropItemAtom";
import type { TileDragSource } from "~/ui/tile/TileDragSource";
import { useTileActorDrag } from "~/ui/tile/useTileActorDrag";

const testState = vi.hoisted(() => ({
	game: undefined as GameEngine | undefined,
	press: vi.fn(() => true),
	startDrag: vi.fn(),
	moveDrag: vi.fn(),
	release: vi.fn(),
	completeDrop: vi.fn(),
	cancel: vi.fn(),
}));

vi.mock("motion/react", () => ({
	useDragControls: () => ({
		start: vi.fn(),
		cancel: vi.fn(),
	}),
	useMotionValue: (value: number) => ({
		get: () => value,
		set: vi.fn(),
	}),
}));

vi.mock("~/bridge/game/useGameEngine", () => ({
	useGameEngine: () => {
		if (testState.game === undefined) throw new Error("Test Game is missing.");
		return testState.game;
	},
}));

vi.mock("~/ui/tile/useTileActorInteraction", () => ({
	useTileActorInteraction: () => null,
}));

vi.mock("~/ui/tile/useTileActorSystem", () => ({
	useTileActorSystem: () => ({
		press: testState.press,
		startDrag: testState.startDrag,
		moveDrag: testState.moveDrag,
		release: testState.release,
		completeDrop: testState.completeDrop,
		cancel: testState.cancel,
	}),
}));

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const source: TileDragSource = {
	id: "runtime:source",
	revision: "revision:source",
	location: {
		scope: "board",
		space: 0,
		position: {
			x: 0,
			y: 0,
		},
	},
	surface: {
		id: "board:0",
		kind: "board",
		space: 0,
	},
	slot: {
		id: "0:0",
		x: 0,
		y: 0,
	},
};

const roots: Array<ReturnType<typeof createRoot>> = [];
const registries: AtomRegistry.AtomRegistry[] = [];
let drag: ReturnType<typeof useTileActorDrag> | undefined;

const createGame = (command: Effect.Effect<dropItemAtom.Result, unknown>) =>
	({
		runFx: vi.fn(() => command),
	}) as unknown as GameEngine;

const Probe = ({ version }: { readonly version: number }) => {
	void version;
	drag = useTileActorDrag({
		canonicalSource: source,
		live: true,
	});
	return null;
};

const renderProbe = async (game: GameEngine) => {
	testState.game = game;
	const registry = AtomRegistry.make({
		scheduleTask,
	});
	registries.push(registry);
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => {
		root.render(
			createElement(
				RegistryContext.Provider,
				{
					value: registry,
				},
				createElement(Probe, {
					version: 0,
				}),
			),
		);
	});
	return {
		registry,
		root,
	};
};

const dispatchDrop = async () => {
	const current = drag;
	if (current === undefined) throw new Error("Drag hook is not mounted.");
	await act(async () => {
		current.onPointerDown({
			isPrimary: true,
			button: 0,
		} as ReactPointerEvent<HTMLButtonElement>);
		current.onDragStart(
			{} as PointerEvent,
			{
				point: {
					x: 10,
					y: 10,
				},
			} as PanInfo,
		);
		current.onDragEnd({} as PointerEvent, {} as PanInfo);
		await Promise.resolve();
	});
};

beforeEach(() => {
	drag = undefined;
	testState.game = undefined;
	testState.press.mockReset();
	testState.press.mockReturnValue(true);
	testState.startDrag.mockReset();
	testState.moveDrag.mockReset();
	testState.release.mockReset();
	testState.release.mockReturnValue({
		source,
		generation: 1,
		target: {
			kind: "outside",
		},
	});
	testState.completeDrop.mockReset();
	testState.cancel.mockReset();
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	for (const registry of registries.splice(0)) registry.dispose();
	vi.restoreAllMocks();
	document.body.replaceChildren();
});

describe("useTileActorDrag command lifecycle", () => {
	it("keeps the drop awaiting until success and completes its generation exactly once", async () => {
		const gate = Effect.runSync(Deferred.make<void>());
		await renderProbe(
			createGame(
				Deferred.await(gate).pipe(
					Effect.as({
						kind: "reject",
						reason: "unsupported-target",
						itemId: source.id,
					} satisfies dropItemAtom.Result),
				),
			),
		);

		await dispatchDrop();
		expect(testState.completeDrop).not.toHaveBeenCalled();

		Effect.runSync(Deferred.succeed(gate, undefined));
		await vi.waitFor(() => expect(testState.completeDrop).toHaveBeenCalledOnce());
		expect(testState.completeDrop).toHaveBeenCalledWith(source, 1);
	});

	it.each([
		{
			label: "typed failure",
			failure: new Error("typed drop failure"),
			command: (failure: Error) => Effect.fail(failure),
		},
		{
			label: "defect",
			failure: new Error("drop defect"),
			command: (failure: Error) => Effect.die(failure),
		},
	])("logs one $label and still completes exactly once", async ({ command, failure, label }) => {
		const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
		await renderProbe(createGame(command(failure)));

		await dispatchDrop();
		await vi.waitFor(() => expect(testState.completeDrop).toHaveBeenCalledOnce());

		expect(error).toHaveBeenCalledOnce();
		expect(error).toHaveBeenCalledWith(
			"Tile drop failed.",
			label === "defect" ? Cause.die(failure) : failure,
		);
	});

	it("interrupts an owned command on unmount without logging interruption", async () => {
		const entered = Effect.runSync(Deferred.make<void>());
		const interrupted = Effect.runSync(Deferred.make<void>());
		const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const { root } = await renderProbe(
			createGame(
				Deferred.succeed(entered, undefined).pipe(
					Effect.andThen(Effect.never),
					Effect.onInterrupt(() =>
						Deferred.succeed(interrupted, undefined).pipe(Effect.asVoid),
					),
				),
			),
		);
		await dispatchDrop();
		await Effect.runPromise(Deferred.await(entered));

		await act(async () => root.unmount());
		roots.splice(roots.indexOf(root), 1);
		await Effect.runPromise(Deferred.await(interrupted));
		await vi.waitFor(() => expect(testState.completeDrop).toHaveBeenCalledOnce());

		expect(error).not.toHaveBeenCalled();
	});

	it("disposes the registry before React cleanup without reviving the command node", async () => {
		const entered = Effect.runSync(Deferred.make<void>());
		const interrupted = Effect.runSync(Deferred.make<void>());
		const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const { registry, root } = await renderProbe(
			createGame(
				Deferred.succeed(entered, undefined).pipe(
					Effect.andThen(Effect.never),
					Effect.onInterrupt(() =>
						Deferred.succeed(interrupted, undefined).pipe(Effect.asVoid),
					),
				),
			),
		);
		await dispatchDrop();
		await Effect.runPromise(Deferred.await(entered));

		registry.dispose();
		registries.splice(registries.indexOf(registry), 1);
		await Effect.runPromise(Deferred.await(interrupted));
		await act(async () => root.unmount());
		roots.splice(roots.indexOf(root), 1);

		expect(registry.getNodes().size).toBe(0);
		expect(testState.completeDrop).toHaveBeenCalledOnce();
		expect(testState.completeDrop).toHaveBeenCalledWith(source, 1);
		expect(error).not.toHaveBeenCalled();
	});

	it("interrupts Game A before one replacement Game B command starts", async () => {
		const entered = Effect.runSync(Deferred.make<void>());
		const interrupted = Effect.runSync(Deferred.make<void>());
		const gameA = createGame(
			Deferred.succeed(entered, undefined).pipe(
				Effect.andThen(Effect.never),
				Effect.onInterrupt(() =>
					Deferred.succeed(interrupted, undefined).pipe(Effect.asVoid),
				),
			),
		);
		const gameB = createGame(
			Effect.succeed({
				kind: "reject",
				reason: "unsupported-target",
				itemId: source.id,
			}),
		);
		const { registry, root } = await renderProbe(gameA);
		await dispatchDrop();
		await Effect.runPromise(Deferred.await(entered));

		testState.game = gameB;
		await act(async () => {
			root.render(
				createElement(
					RegistryContext.Provider,
					{
						value: registry,
					},
					createElement(Probe, {
						version: 1,
					}),
				),
			);
		});
		await Effect.runPromise(Deferred.await(interrupted));
		await vi.waitFor(() => expect(testState.completeDrop).toHaveBeenCalledOnce());

		testState.completeDrop.mockClear();
		await dispatchDrop();
		await vi.waitFor(() => expect(testState.completeDrop).toHaveBeenCalledOnce());
		expect(gameA.runFx).toHaveBeenCalledOnce();
		expect(gameB.runFx).toHaveBeenCalledOnce();
	});
});
