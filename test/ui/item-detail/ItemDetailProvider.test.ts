// @vitest-environment jsdom

import { Deferred, Effect } from "effect";
import { act, createElement, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { GameEngine } from "~/bridge/game/GameEngine";
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
const providerGame = {
	id: "game:item-detail-provider",
} as unknown as GameEngine;

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
	props: Parameters<ItemDetailControl["runPendingAction"]>[0],
) => control.runPendingAction(props);

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
	const render = (game: GameEngine = providerGame) =>
		root.render(
			createElement(
				ItemDetailProvider,
				{
					game,
				},
				createElement(Probe, {
					onControl: (next) => {
						control = next;
					},
				}),
			),
		);
	await act(async () => {
		render();
	});
	if (control === undefined) throw new Error("Missing Item Detail control.");
	return {
		readControl: () => {
			if (control === undefined) throw new Error("Missing Item Detail control.");
			return control;
		},
		render,
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
					{
						game: providerGame,
					},
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
				linesSearchQuery: "  Water  ",
			});
		});
		expect(readControl().state).toMatchObject({
			phase: "open",
			generation: entering.generation,
			target: {
				itemId: "runtime:first",
				tab: "lines",
				linesSearchQuery: "Water",
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

	it("cancels pending commands when the exact Game owner is replaced", async () => {
		const { readControl, render } = await renderProvider();
		await act(async () => {
			openItemDetail(readControl(), {
				itemId: "runtime:first",
				tab: "lines",
			});
		});
		const entering = readControl().state;
		if (entering.phase !== "entering") throw new Error("Expected entering state.");
		await act(async () => completeEnter(readControl(), entering.generation));
		const interrupted = vi.fn();
		await act(async () => {
			readControl().runPendingAction({
				key: "line:runtime:first",
				action: "autofill",
				failureMessage: "Autofill failed.",
				run: Effect.never.pipe(Effect.onInterrupt(() => Effect.sync(interrupted))),
			});
			await Promise.resolve();
		});
		expect(readControl().readPendingAction("line:runtime:first")).toBe("autofill");

		await act(async () => {
			render({
				id: "game:item-detail-provider:replacement",
			} as unknown as GameEngine);
		});

		await vi.waitFor(() => expect(interrupted).toHaveBeenCalledOnce());
		expect(readControl().readPendingAction("line:runtime:first")).toBeNull();
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

		const firstFailure = Effect.runSync(Deferred.make<never, Error>());
		const firstError = new Error("First deferred failure.");
		await act(async () => {
			runPendingAction(readControl(), {
				key: "line:runtime:first",
				action: "default",
				failureMessage: "First action failed.",
				run: Deferred.await(firstFailure),
			});
			expect(
				openItemDetail(readControl(), {
					itemId: "runtime:first",
					tab: "info",
				}),
			).toBe(true);
			Effect.runSync(Deferred.fail(firstFailure, firstError));
		});
		await vi.waitFor(() =>
			expect(readControl().readActionError("line:runtime:first")).toBe(
				"First deferred failure.",
			),
		);

		await act(async () => {
			openItemDetail(readControl(), {
				itemId: "runtime:second",
				tab: "lines",
			});
		});
		expect(readControl().readActionError("line:runtime:first")).toBeNull();

		const secondFailure = Effect.runSync(Deferred.make<never, Error>());
		const secondError = new Error("Late failure after close.");
		await act(async () => {
			runPendingAction(readControl(), {
				key: "line:runtime:second",
				action: "enqueue",
				failureMessage: "Second action failed.",
				run: Deferred.await(secondFailure),
			});
			const closeOutcome = close(readControl());
			await Promise.resolve();
			const exiting = readControl().state;
			if (exiting.phase !== "exiting") throw new Error("Expected exiting state.");
			completeExit(readControl(), exiting.generation);
			await closeOutcome;
			expect(readControl().state.phase).toBe("closed");
			Effect.runSync(Deferred.fail(secondFailure, secondError));
		});
		await vi.waitFor(() =>
			expect(readControl().readPendingAction("line:runtime:second")).toBeNull(),
		);
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

	it("yields to Game Menu while an Item Detail command settles independently", async () => {
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
		await act(async () => {
			runPendingAction(readItemDetail(), {
				key: "line:runtime:first",
				action: "enqueue",
				failureMessage: "Start failed.",
				run: Effect.promise(() => run),
			});
		});

		await act(async () => {
			readGameMenu().open();
			await Promise.resolve();
		});

		expect(readGameMenu().phase).toBe("entering");
		expect(readItemDetail().state).toMatchObject({
			phase: "exiting",
			restoreFocus: false,
		});
		expect(readItemDetail().readPendingAction("line:runtime:first")).toBe("enqueue");

		await act(async () => {
			completeRun?.();
		});
		await vi.waitFor(() =>
			expect(readItemDetail().readPendingAction("line:runtime:first")).toBeNull(),
		);
		expect(readGameMenu().phase).toBe("entering");
		expect(readItemDetail().state.phase).toBe("exiting");
	});
});
