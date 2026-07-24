// @vitest-environment jsdom

import { RegistryContext, scheduleTask } from "@effect/atom-react";
import { Cause, Data, Deferred, Effect, Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { act, createElement, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Game } from "~/bridge/game/Game";
import { useAutofillItemDetailLine } from "~/bridge/item-detail/useAutofillItemDetailLine";
import { useClearItemDetailQueue } from "~/bridge/item-detail/useClearItemDetailQueue";
import { useSetDefaultItemDetailLine } from "~/bridge/item-detail/useSetDefaultItemDetailLine";
import { useStartPendingItemDetailLine } from "~/bridge/item-detail/useStartItemDetailLine";
import { useUnsetDefaultItemDetailLine } from "~/bridge/item-detail/useUnsetDefaultItemDetailLine";
import { useWithdrawItemDetailLine } from "~/bridge/item-detail/useWithdrawItemDetailLine";
import type { ItemDetailController } from "~/ui/item-detail/createItemDetailControllerFx";
import { createItemDetailControllerFx } from "~/ui/item-detail/createItemDetailControllerFx";

const engineCommands = vi.hoisted(() => ({
	autofill: vi.fn(),
	clearQueue: vi.fn(),
	setDefault: vi.fn(),
	start: vi.fn(),
	unsetDefault: vi.fn(),
	withdraw: vi.fn(),
}));

const gameState = vi.hoisted(() => ({
	game: undefined as Game | undefined,
}));

class ExpectedItemDetailCommandFailure extends Data.TaggedError(
	"ExpectedItemDetailCommandFailure",
)<{
	readonly message: string;
}> {}

vi.mock("~/bridge/game/useGameEngine", () => ({
	useGameEngine: () => {
		if (gameState.game === undefined) throw new Error("Missing test Game.");
		return gameState.game;
	},
}));
vi.mock("~/engine/input/write/autofillLineInputsFx", () => ({
	autofillLineInputsFx: (props: unknown) => engineCommands.autofill(props),
}));
vi.mock("~/engine/job/write/clearItemJobQueueFx", () => ({
	clearItemJobQueueFx: (props: unknown) => engineCommands.clearQueue(props),
}));
vi.mock("~/engine/line/write/setDefaultLineFx", () => ({
	setDefaultLineFx: (props: unknown) => engineCommands.setDefault(props),
}));
vi.mock("~/engine/job/write/startLineFx", () => ({
	startLineFx: (props: unknown) => engineCommands.start(props),
}));
vi.mock("~/engine/line/write/unsetDefaultLineFx", () => ({
	unsetDefaultLineFx: (props: unknown) => engineCommands.unsetDefault(props),
}));
vi.mock("~/engine/input/write/withdrawLineInputsFx", () => ({
	withdrawLineInputsFx: (props: unknown) => engineCommands.withdraw(props),
}));

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

interface Commands {
	readonly autofill: (props: { readonly ownerItemId: string; readonly lineId: string }) => void;
	readonly autofillResult: ReturnType<typeof useAutofillItemDetailLine>["result"];
	readonly clearQueue: (props: { readonly ownerItemId: string }) => void;
	readonly setDefault: (props: { readonly ownerItemId: string; readonly lineId: string }) => void;
	readonly start: (props: { readonly ownerItemId: string; readonly lineId: string }) => void;
	readonly unsetDefault: (props: { readonly ownerItemId: string }) => void;
	readonly withdraw: (props: { readonly ownerItemId: string; readonly lineId: string }) => void;
}

const roots: Array<ReturnType<typeof createRoot>> = [];
const registries: AtomRegistry.AtomRegistry[] = [];

const makeGame = (id: string) =>
	({
		id,
		runFx: ((effect: Effect.Effect<unknown, unknown>) => effect) as unknown as Game["runFx"],
	}) as unknown as Game;

const makeRegistry = () => {
	const registry = AtomRegistry.make({
		defaultIdleTTL: 400,
		scheduleTask,
	});
	registries.push(registry);
	return registry;
};

const openController = () => {
	const controller = Effect.runSync(createItemDetailControllerFx());
	Effect.runSync(
		controller.openTargetFx({
			kind: "runtime",
			itemId: "runtime:owner",
			tab: "lines",
			origin: null,
		}),
	);
	const entering = controller.getSnapshot().state;
	if (entering.phase !== "entering") throw new Error("Expected entering Item Detail.");
	Effect.runSync(controller.completeEnterFx(entering.generation));
	return controller;
};

const CommandProbe = ({
	controller,
	lineKey,
	onCommands,
}: {
	readonly controller: ItemDetailController;
	readonly lineKey: string;
	readonly onCommands: (commands: Commands) => void;
}) => {
	const pendingOptions = {
		pendingKey: lineKey,
		pendingOwner: controller,
	} as const;
	const autofill = useAutofillItemDetailLine(pendingOptions);
	const clearQueue = useClearItemDetailQueue({
		pendingKey: `${lineKey}:queue`,
		pendingOwner: controller,
	});
	const setDefault = useSetDefaultItemDetailLine(pendingOptions);
	const start = useStartPendingItemDetailLine(pendingOptions);
	const unsetDefault = useUnsetDefaultItemDetailLine(pendingOptions);
	const withdraw = useWithdrawItemDetailLine(pendingOptions);
	useEffect(() => {
		onCommands({
			autofill: autofill.run,
			autofillResult: autofill.result,
			clearQueue: clearQueue.run,
			setDefault: setDefault.run,
			start: start.start,
			unsetDefault: unsetDefault.run,
			withdraw: withdraw.run,
		});
	}, [
		autofill,
		clearQueue,
		onCommands,
		setDefault,
		start,
		unsetDefault,
		withdraw,
	]);
	return null;
};

const renderProbes = async ({
	controller,
	game = makeGame("game:first"),
	lineKeys = [
		"line:first",
	],
	registry = makeRegistry(),
}: {
	readonly controller: ItemDetailController;
	readonly game?: Game;
	readonly lineKeys?: readonly string[];
	readonly registry?: AtomRegistry.AtomRegistry;
}) => {
	gameState.game = game;
	const commands = new Map<string, Commands>();
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	const render = () =>
		root.render(
			createElement(
				RegistryContext.Provider,
				{
					value: registry,
				},
				...lineKeys.map((lineKey) =>
					createElement(CommandProbe, {
						key: lineKey,
						controller,
						lineKey,
						onCommands: (next) => commands.set(lineKey, next),
					}),
				),
			),
		);
	await act(async () => render());
	return {
		commands,
		registry,
		render,
		root,
	};
};

beforeEach(() => {
	for (const command of Object.values(engineCommands)) {
		command.mockReset();
		command.mockReturnValue(Effect.void);
	}
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	for (const registry of registries.splice(0)) registry.dispose();
	gameState.game = undefined;
	document.body.replaceChildren();
});

describe("Item Detail command Atoms", () => {
	it("runs all six authoritative line and queue commands through game.runFx", async () => {
		const controller = openController();
		const { commands } = await renderProbes({
			controller,
		});
		const command = commands.get("line:first");
		if (command === undefined) throw new Error("Missing Item Detail commands.");

		await act(async () => {
			command.autofill({
				ownerItemId: "runtime:owner",
				lineId: "line:first",
			});
			command.clearQueue({
				ownerItemId: "runtime:owner",
			});
			command.setDefault({
				ownerItemId: "runtime:owner",
				lineId: "line:first",
			});
			command.start({
				ownerItemId: "runtime:owner",
				lineId: "line:first",
			});
			command.unsetDefault({
				ownerItemId: "runtime:owner",
			});
			command.withdraw({
				ownerItemId: "runtime:owner",
				lineId: "line:first",
			});
		});

		await vi.waitFor(() => {
			for (const engineCommand of Object.values(engineCommands)) {
				expect(engineCommand).toHaveBeenCalledOnce();
			}
		});
		expect(controller.getSnapshot().pendingActions.size).toBe(0);
	});

	it("rejects a same-key duplicate while different line keys run independently", async () => {
		const controller = openController();
		const firstGate = Effect.runSync(Deferred.make<void>());
		const secondGate = Effect.runSync(Deferred.make<void>());
		const entered: string[] = [];
		engineCommands.autofill.mockImplementation((props: { readonly lineId: string }) =>
			Effect.sync(() => {
				entered.push(props.lineId);
			}).pipe(
				Effect.andThen(
					Deferred.await(props.lineId === "line:first" ? firstGate : secondGate),
				),
			),
		);
		const { commands } = await renderProbes({
			controller,
			lineKeys: [
				"line:first",
				"line:second",
			],
		});
		const first = commands.get("line:first");
		const second = commands.get("line:second");
		if (first === undefined || second === undefined) throw new Error("Missing commands.");

		await act(async () => {
			first.autofill({
				ownerItemId: "runtime:owner",
				lineId: "line:first",
			});
			first.autofill({
				ownerItemId: "runtime:owner",
				lineId: "line:first",
			});
			second.autofill({
				ownerItemId: "runtime:owner",
				lineId: "line:second",
			});
		});
		await vi.waitFor(() =>
			expect(entered).toEqual([
				"line:first",
				"line:second",
			]),
		);
		expect(controller.readPendingAction("line:first")).toBe("autofill");
		expect(controller.readPendingAction("line:second")).toBe("autofill");

		await act(async () => {
			Effect.runSync(Deferred.succeed(firstGate, undefined));
		});
		await vi.waitFor(() => expect(controller.readPendingAction("line:first")).toBeNull());
		expect(controller.readPendingAction("line:second")).toBe("autofill");

		await act(async () => {
			Effect.runSync(Deferred.succeed(secondGate, undefined));
		});
		await vi.waitFor(() => expect(controller.readPendingAction("line:second")).toBeNull());
	});

	it("keeps a tagged typed failure in the Atom result while projecting its UI message", async () => {
		const controller = openController();
		const failure = new ExpectedItemDetailCommandFailure({
			message: "Autofill domain failure.",
		});
		engineCommands.autofill.mockReturnValue(Effect.fail(failure));
		const { commands } = await renderProbes({
			controller,
		});
		const command = commands.get("line:first");
		if (command === undefined) throw new Error("Missing Item Detail commands.");

		await act(async () => {
			command.autofill({
				ownerItemId: "runtime:owner",
				lineId: "line:first",
			});
		});

		await vi.waitFor(() => {
			const current = commands.get("line:first");
			if (current === undefined) throw new Error("Missing Item Detail commands.");
			expect(AsyncResult.isFailure(current.autofillResult)).toBe(true);
			if (!AsyncResult.isFailure(current.autofillResult)) {
				throw new Error("Expected Autofill Atom failure.");
			}
			expect(current.autofillResult.waiting).toBe(false);
		});
		const settled = commands.get("line:first")?.autofillResult;
		if (settled === undefined || !AsyncResult.isFailure(settled)) {
			throw new Error("Expected settled Autofill Atom failure.");
		}
		expect(Cause.findErrorOption(settled.cause)).toEqual(Option.some(failure));
		expect(controller.readActionError("line:first")).toBe("Autofill domain failure.");
		expect(controller.readPendingAction("line:first")).toBeNull();
	});

	it("interrupts Game A on replacement, ignores its stale failure, and cleans on registry disposal", async () => {
		const controller = openController();
		let rejectGameA: ((cause: Error) => void) | undefined;
		const gameAPromise = new Promise<never>((_resolve, reject) => {
			rejectGameA = reject;
		});
		const gameAInterrupted = vi.fn();
		const gameBInterrupted = vi.fn();
		engineCommands.start
			.mockImplementationOnce(() =>
				Effect.tryPromise({
					try: () => gameAPromise,
					catch: (cause) => cause,
				}).pipe(Effect.onInterrupt(() => Effect.sync(gameAInterrupted))),
			)
			.mockImplementationOnce(() =>
				Effect.never.pipe(Effect.onInterrupt(() => Effect.sync(gameBInterrupted))),
			);
		const gameA = makeGame("game:a");
		const gameB = makeGame("game:b");
		const rendered = await renderProbes({
			controller,
			game: gameA,
		});
		const gameACommands = rendered.commands.get("line:first");
		if (gameACommands === undefined) throw new Error("Missing Game A commands.");

		await act(async () =>
			gameACommands.start({
				ownerItemId: "runtime:owner",
				lineId: "line:first",
			}),
		);
		await vi.waitFor(() => expect(controller.readPendingAction("line:first")).toBe("start"));

		gameState.game = gameB;
		await act(async () => rendered.render());
		await vi.waitFor(() => expect(gameAInterrupted).toHaveBeenCalledOnce());
		expect(controller.readPendingAction("line:first")).toBeNull();

		await act(async () => {
			rejectGameA?.(new Error("Stale Game A failure."));
			await Promise.resolve();
		});
		expect(controller.readActionError("line:first")).toBeNull();

		const gameBCommands = rendered.commands.get("line:first");
		if (gameBCommands === undefined) throw new Error("Missing Game B commands.");
		await act(async () =>
			gameBCommands.start({
				ownerItemId: "runtime:owner",
				lineId: "line:first",
			}),
		);
		await vi.waitFor(() => expect(controller.readPendingAction("line:first")).toBe("start"));

		await act(async () => rendered.registry.dispose());
		await vi.waitFor(() => expect(gameBInterrupted).toHaveBeenCalledOnce());
		expect(controller.readPendingAction("line:first")).toBeNull();
	});
});
