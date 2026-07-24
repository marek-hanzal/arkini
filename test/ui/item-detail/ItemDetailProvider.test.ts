// @vitest-environment jsdom

import { Cause, Effect, Exit, Option } from "effect";
import { act, createElement, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { GameMenuControl } from "~/ui/game-menu/GameMenuControl";
import { GameMenuProvider } from "~/ui/game-menu/GameMenuProvider";
import { useGameMenuControl } from "~/ui/game-menu/useGameMenuControl";
import type { ItemDetailControl } from "~/ui/item-detail/ItemDetailControl";
import { ItemDetailHigherOwnerGuard } from "~/ui/item-detail/ItemDetailHigherOwnerGuard";
import { ItemDetailProvider } from "~/ui/item-detail/ItemDetailProvider";
import { useItemDetailControl } from "~/ui/item-detail/useItemDetailControl";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("~/bridge/game/useGameEngine", () => ({
	useGameEngine: () => ({
		config: {
			items: {
				"definition:item": {
					id: "definition:item",
				},
			},
		},
	}),
}));

vi.mock("~/bridge/item-detail/useResolveItemDetailTarget", () => ({
	useResolveItemDetailTarget:
		() =>
		({ itemId, requestedTab }: { itemId: string; requestedTab?: string }) =>
			itemId === "runtime:missing"
				? ({
						kind: "unavailable",
					} as const)
				: ({
						kind: "available",
						itemId,
						tab: requestedTab ?? "lines",
						tabs: [
							"lines",
							"info",
						],
					} as const),
}));

vi.mock("~/bridge/item-detail/useResolveItemDefinitionDetailTarget", () => ({
	useResolveItemDefinitionDetailTarget:
		() =>
		({ itemId, requestedTab }: { itemId: string; requestedTab?: "info" | "sources" }) =>
			itemId === "definition:item"
				? ({
						kind: "available",
						itemId,
						tab: requestedTab ?? "info",
					} as const)
				: ({
						kind: "unavailable",
					} as const),
}));

const roots: Array<ReturnType<typeof createRoot>> = [];

const openItemDetail = (
	control: ItemDetailControl,
	props: Parameters<ItemDetailControl["openItemDetailFx"]>[0],
) => Effect.runSync(control.openItemDetailFx(props));

const openItemDefinitionDetail = (
	control: ItemDetailControl,
	props: Parameters<ItemDetailControl["openItemDefinitionDetailFx"]>[0],
) => Effect.runSync(control.openItemDefinitionDetailFx(props));

const completeEnter = (control: ItemDetailControl, generation: number) =>
	Effect.runSync(control.completeEnterFx(generation));

const completeExit = (control: ItemDetailControl, generation: number) =>
	Effect.runSync(control.completeExitFx(generation));

const close = (control: ItemDetailControl, props?: Parameters<ItemDetailControl["closeFx"]>[0]) =>
	Effect.runPromise(control.closeFx(props));

const runPendingAction = (
	control: ItemDetailControl,
	props: Parameters<ItemDetailControl["runPendingActionFx"]>[0],
) => Effect.runPromiseExit(control.runPendingActionFx(props));

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

const Probe = ({ onControl }: { readonly onControl: (control: ItemDetailControl) => void }) => {
	const control = useItemDetailControl();
	useEffect(
		() => onControl(control),
		[
			control,
			onControl,
		],
	);
	return null;
};

const MenuProbe = ({ onControl }: { readonly onControl: (control: GameMenuControl) => void }) => {
	const control = useGameMenuControl();
	useEffect(
		() => onControl(control),
		[
			control,
			onControl,
		],
	);
	return null;
};

const renderProvider = async () => {
	let control: ItemDetailControl | undefined;
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => {
		root.render(
			createElement(
				ItemDetailProvider,
				null,
				createElement(Probe, {
					onControl: (next) => {
						control = next;
					},
				}),
			),
		);
	});
	if (control === undefined) throw new Error("Missing Item Detail control.");
	return {
		readControl: () => {
			if (control === undefined) throw new Error("Missing Item Detail control.");
			return control;
		},
		root,
	};
};

const renderGuardedProvider = async () => {
	let itemDetail: ItemDetailControl | undefined;
	let gameMenu: GameMenuControl | undefined;
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => {
		root.render(
			createElement(
				GameMenuProvider,
				null,
				createElement(
					ItemDetailProvider,
					null,
					createElement(ItemDetailHigherOwnerGuard),
					createElement(Probe, {
						onControl: (next) => {
							itemDetail = next;
						},
					}),
					createElement(MenuProbe, {
						onControl: (next) => {
							gameMenu = next;
						},
					}),
				),
			),
		);
	});
	return {
		readItemDetail: () => {
			if (itemDetail === undefined) throw new Error("Missing Item Detail control.");
			return itemDetail;
		},
		readGameMenu: () => {
			if (gameMenu === undefined) throw new Error("Missing Game Menu control.");
			return gameMenu;
		},
	};
};

describe("ItemDetailProvider", () => {
	it("keeps target and phase exhaustive across switch, replacement, and stale completion", async () => {
		const { readControl } = await renderProvider();
		const origin = document.createElement("button");
		document.body.append(origin);

		await act(async () => {
			expect(
				openItemDetail(readControl(), {
					itemId: "runtime:first",
					tab: "info",
					origin,
				}),
			).toBe(true);
		});
		const entering = readControl().state;
		expect(entering).toMatchObject({
			phase: "entering",
			target: {
				itemId: "runtime:first",
				tab: "info",
				origin,
			},
		});
		if (entering.phase !== "entering") throw new Error("Expected entering state.");

		await act(async () => completeEnter(readControl(), entering.generation));
		expect(readControl().state.phase).toBe("open");

		await act(async () => {
			openItemDetail(readControl(), {
				itemId: "runtime:first",
				tab: "lines",
			});
		});
		expect(readControl().state).toMatchObject({
			phase: "open",
			generation: entering.generation,
			target: {
				itemId: "runtime:first",
				tab: "lines",
				origin,
			},
		});

		await act(async () => {
			openItemDetail(readControl(), {
				itemId: "runtime:second",
				tab: "info",
			});
		});
		expect(readControl().state).toMatchObject({
			phase: "open",
			generation: entering.generation,
			target: {
				itemId: "runtime:second",
				tab: "info",
				origin,
			},
		});

		let firstClose: Promise<void> | undefined;
		await act(async () => {
			firstClose = close(readControl());
			void close(readControl());
		});
		expect(readControl().state.phase).toBe("exiting");

		await act(async () => {
			openItemDetail(readControl(), {
				itemId: "runtime:second",
				tab: "info",
			});
			await firstClose;
		});
		const replacement = readControl().state;
		expect(replacement).toMatchObject({
			phase: "entering",
			target: {
				itemId: "runtime:second",
				tab: "info",
			},
		});
		if (replacement.phase !== "entering") throw new Error("Expected replacement enter.");

		await act(async () => completeExit(readControl(), entering.generation));
		expect(readControl().state.phase).toBe("entering");
		await act(async () => completeEnter(readControl(), replacement.generation));
		expect(readControl().state.phase).toBe("open");
	});

	it("rejects stale targets without changing the closed owner", async () => {
		const { readControl } = await renderProvider();
		expect(
			openItemDetail(readControl(), {
				itemId: "runtime:missing",
				tab: "info",
			}),
		).toBe(false);
		expect(readControl().state).toEqual({
			phase: "closed",
		});
	});

	it("retains action errors across tabs but evicts them across target and exit lifecycles", async () => {
		const { readControl } = await renderProvider();
		await act(async () => {
			openItemDetail(readControl(), {
				itemId: "runtime:first",
				tab: "lines",
			});
		});
		const entering = readControl().state;
		if (entering.phase !== "entering") throw new Error("Expected entering state.");
		await act(async () => completeEnter(readControl(), entering.generation));

		let rejectFirst: ((cause: Error) => void) | undefined;
		const firstFailure = new Promise<never>((_resolve, reject) => {
			rejectFirst = reject;
		});
		let firstOutcome: ReturnType<typeof runPendingAction> | undefined;
		let firstExit: Exit.Exit<unknown, unknown> | undefined;
		const firstError = new Error("First deferred failure.");
		await act(async () => {
			firstOutcome = runPendingAction(readControl(), {
				key: "line:runtime:first",
				action: "default",
				failureMessage: "First action failed.",
				run: Effect.tryPromise({
					try: () => firstFailure,
					catch: (cause) => cause,
				}),
			});
			expect(
				openItemDetail(readControl(), {
					itemId: "runtime:first",
					tab: "info",
				}),
			).toBe(false);
			rejectFirst?.(firstError);
			firstExit = await firstOutcome;
		});
		expect(firstExit).toBeDefined();
		if (firstExit === undefined || Exit.isSuccess(firstExit)) {
			throw new Error("Expected first action failure.");
		}
		expect(Cause.findErrorOption(firstExit.cause)).toEqual(Option.some(firstError));
		expect(readControl().readActionError("line:runtime:first")).toBe("First deferred failure.");

		await act(async () => {
			openItemDetail(readControl(), {
				itemId: "runtime:second",
				tab: "lines",
			});
		});
		expect(readControl().readActionError("line:runtime:first")).toBeNull();

		let rejectSecond: ((cause: Error) => void) | undefined;
		const secondFailure = new Promise<never>((_resolve, reject) => {
			rejectSecond = reject;
		});
		let secondOutcome: ReturnType<typeof runPendingAction> | undefined;
		let secondExit: Exit.Exit<unknown, unknown> | undefined;
		const secondError = new Error("Late failure after close.");
		await act(async () => {
			secondOutcome = runPendingAction(readControl(), {
				key: "line:runtime:second",
				action: "start",
				failureMessage: "Second action failed.",
				run: Effect.tryPromise({
					try: () => secondFailure,
					catch: (cause) => cause,
				}),
			});
			await close(readControl());
			expect(readControl().state.phase).toBe("open");
			rejectSecond?.(secondError);
			secondExit = await secondOutcome;
		});
		expect(secondExit).toBeDefined();
		if (secondExit === undefined || Exit.isSuccess(secondExit)) {
			throw new Error("Expected second action failure.");
		}
		expect(Cause.findErrorOption(secondExit.cause)).toEqual(Option.some(secondError));
		expect(readControl().readActionError("line:runtime:second")).toBe(
			"Late failure after close.",
		);
		const secondState = readControl().state;
		if (secondState.phase !== "open") throw new Error("Expected open state.");
		let exit: Promise<void> | undefined;
		await act(async () => {
			exit = close(readControl());
			completeExit(readControl(), secondState.generation);
			await exit;
		});
		expect(readControl().readActionError("line:runtime:second")).toBeNull();
	});

	it("keeps configured definition Info default and accepts an explicit Sources request", async () => {
		const { readControl } = await renderProvider();
		await act(async () => {
			expect(
				openItemDefinitionDetail(readControl(), {
					itemId: "definition:item",
				}),
			).toBe(true);
		});
		const entering = readControl().state;
		expect(entering).toMatchObject({
			phase: "entering",
			target: {
				kind: "definition",
				itemId: "definition:item",
				tab: "info",
			},
		});
		if (entering.phase !== "entering") throw new Error("Expected entering definition.");
		await act(async () => completeEnter(readControl(), entering.generation));

		await act(async () => {
			expect(
				openItemDefinitionDetail(readControl(), {
					itemId: "definition:item",
					tab: "sources",
				}),
			).toBe(true);
		});
		expect(readControl().state).toMatchObject({
			phase: "open",
			generation: entering.generation,
			target: {
				kind: "definition",
				itemId: "definition:item",
				tab: "sources",
			},
		});
	});

	it("yields interaction ownership to the higher-priority game menu", async () => {
		const { readGameMenu, readItemDetail } = await renderGuardedProvider();
		await act(async () => {
			openItemDetail(readItemDetail(), {
				itemId: "runtime:first",
				tab: "info",
			});
		});
		const entering = readItemDetail().state;
		if (entering.phase !== "entering") throw new Error("Expected entering state.");
		await act(async () => completeEnter(readItemDetail(), entering.generation));

		await act(async () => readGameMenu().open());
		expect(readGameMenu().phase).toBe("entering");
		expect(readItemDetail().state).toMatchObject({
			phase: "exiting",
			restoreFocus: false,
			target: {
				itemId: "runtime:first",
			},
		});
	});

	it("rejects Game Menu ownership while an Item Detail command is pending", async () => {
		const { readGameMenu, readItemDetail } = await renderGuardedProvider();
		await act(async () => {
			openItemDetail(readItemDetail(), {
				itemId: "runtime:first",
				tab: "lines",
			});
		});
		const entering = readItemDetail().state;
		if (entering.phase !== "entering") throw new Error("Expected entering state.");
		await act(async () => completeEnter(readItemDetail(), entering.generation));

		let completeRun: (() => void) | undefined;
		const run = new Promise<void>((resolve) => {
			completeRun = resolve;
		});
		let outcome: Promise<unknown> | undefined;
		await act(async () => {
			outcome = runPendingAction(readItemDetail(), {
				key: "line:runtime:first",
				action: "start",
				failureMessage: "Start failed.",
				run: Effect.promise(() => run),
			});
		});

		await act(async () => {
			readGameMenu().open();
			await Promise.resolve();
		});

		expect(readGameMenu().phase).toBe("exiting");
		expect(readItemDetail().state.phase).toBe("open");
		expect(readItemDetail().hasPendingActions).toBe(true);
		expect(readItemDetail().readPendingAction("line:runtime:first")).toBe("start");

		await act(async () => {
			completeRun?.();
			await outcome;
		});
		expect(readGameMenu().phase).toBe("exiting");
		expect(readItemDetail().state.phase).toBe("open");
	});
});
