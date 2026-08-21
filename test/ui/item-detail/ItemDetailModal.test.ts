// @vitest-environment jsdom

import { Deferred, Effect } from "effect";
import { act, createElement, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GameEngine } from "~/bridge/game/GameEngine";
import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import { useGameFx } from "~/engine/game/fx/useGameFx";
import { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { startFx } from "~/engine/start/write/startFx";
import type { ItemDetailControl } from "~/ui/item-detail/ItemDetailControl";
import { ItemDetailModal } from "~/ui/item-detail/ItemDetailModal";
import { ItemDetailProvider } from "~/ui/item-detail/ItemDetailProvider";
import { useItemDetailControl } from "~/ui/item-detail/useItemDetailControl";
import { motionTestRuntime } from "~test/ui/support/motionReactMock";
import { makeTestGameTransitionFieldsFx } from "~test/support/game/makeTestGameTransitionFieldsFx";
import { testGameRead } from "~test/support/game/testGameRead";
import { JobStatusEnumSchema } from "~/engine/job/schema/read/JobStatusEnumSchema";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const gameEngineState = vi.hoisted(() => ({
	game: undefined as GameEngine | undefined,
}));

vi.mock("motion/react", async () => import("~test/ui/support/motionReactMock"));
vi.mock("~/bridge/game/useGameEngine", () => ({
	useGameEngine: () => {
		const current = gameEngineState.game;
		if (current === undefined) throw new Error("Test Game Engine is missing.");
		return current;
	},
}));

const config = GameConfigSchema.parse({
	version: "1.0",
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:item-detail-modal",
		title: "Item Detail modal",
		board: {
			width: 2,
			height: 2,
		},
		inventory: {
			width: 1,
			height: 1,
		},
		toolbarSize: 1,
	},
	start: {
		currentSpace: 0,
		board: [
			{
				itemId: "workshop",
				space: 0,
				x: 0,
				y: 0,
			},
			{
				itemId: "water",
				space: 0,
				x: 1,
				y: 0,
			},
		],
	},
	items: {
		workshop: {
			uid: "workshop",
			id: "workshop",
			type: "producer",
			title: "Workshop",
			description: "Produces water.",
			asset: {
				default: [
					"asset:workshop",
				],
			},
			scope: "any",
			maxStackSize: 1,
			maxQueueSize: 2,
			lines: [
				{
					id: "line:workshop:water",
					title: "Water",
					description: "Create water.",
					runtimeMs: 1_000,
					input: [
						{
							type: "simple",
						},
					],
					output: {
						set: [
							{
								roll: [
									{
										type: "guaranteed",
										drop: [
											{
												itemId: "water",
												quantity: {
													min: 1,
													max: 1,
												},
												rules: [],
											},
										],
									},
								],
							},
						],
					},
					rules: [],
				},
			],
		},
		water: {
			uid: "water",
			id: "water",
			type: "simple",
			title: "Water",
			description: "Water.",
			asset: {
				default: [
					"asset:water",
				],
			},
			scope: "any",
			maxStackSize: 10,
		},
	},
});

const initialRuntime = Effect.runSync(
	startFx().pipe(
		useGameFx({
			config,
		}),
	),
);
let currentRuntime = initialRuntime;
const runtimeListeners = new Set<() => void>();
const transitionAtomFields = Effect.runSync(makeTestGameTransitionFieldsFx(currentRuntime));
const publishRuntime = (runtime: RuntimeSchema.Type) => {
	currentRuntime = runtime;
	Effect.runSync(transitionAtomFields.publishRuntimeFx(runtime));
	for (const listener of runtimeListeners) listener();
};

const readOrThrowWithConfig = <Result, Error>(
	effect: Effect.Effect<Result, Error, GameConfigFx>,
): Result => Effect.runSync(effect.pipe(Effect.provideService(GameConfigFx, config)));

const game = {
	arkpack: {
		packageId: "test-package",
		hash: "test-hash",
		gameId: config.meta.id,
		title: config.meta.title,
		game: config.version,
		trust: {
			type: "external",
			reason: "unsigned",
		} as const,
		source: "imported" as const,
	},
	config,
	saveKey: {
		packageId: "test-package",
		contentHash: "0".repeat(64),
	},
	getFatalError: () => null,
	getSnapshot: () => currentRuntime,
	committedTransitionAtom: transitionAtomFields.committedTransitionAtom,
	failStop: transitionAtomFields.failStop,
	getTransitionSnapshot: () => ({
		sequence: 0,
		previousRuntime: null,
		runtime: currentRuntime,
		events: [],
	}),
	getResourceUrl: (resourceId: string) => `resource:${resourceId}`,
	subscribe: (listener: () => void) => {
		runtimeListeners.add(listener);
		return () => runtimeListeners.delete(listener);
	},
	subscribeTransitions: (listener) => {
		void listener({
			sequence: 0,
			previousRuntime: null,
			runtime: currentRuntime,
			events: [],
		});
		return () => undefined;
	},
	subscribeEvents: () => () => undefined,
	subscribeFatalError: () => () => undefined,
	read: testGameRead,
	readOrThrow: readOrThrowWithConfig as GameEngine["readOrThrow"],
	reportCriticalFailure: () => undefined,
	runFx: transitionAtomFields.runFx,
	run: (() => Promise.reject(new Error("Not used by this test."))) as GameEngine["run"],
	disposeFx: Effect.void,
	disposeWithoutSaveFx: Effect.void,
	flushSaveFx: Effect.void,
} satisfies GameEngine;

const roots: Array<ReturnType<typeof createRoot>> = [];

const openItemDetail = (
	control: ItemDetailControl,
	props: Parameters<ItemDetailControl["openItemDetailFx"]>[0],
) => Effect.runSync(control.openItemDetailFx(props));

const openItemDefinitionDetail = (
	control: ItemDetailControl,
	props: Parameters<ItemDetailControl["openItemDefinitionDetailFx"]>[0],
) => Effect.runSync(control.openItemDefinitionDetailFx(props));

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

beforeEach(() => {
	motionTestRuntime.reset();
	currentRuntime = initialRuntime;
	Effect.runSync(transitionAtomFields.resetRuntimeFx(currentRuntime));
	runtimeListeners.clear();
	gameEngineState.game = game;
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
	gameEngineState.game = undefined;
	vi.restoreAllMocks();
});

const renderItemDetail = async () => {
	let control: ItemDetailControl | undefined;
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => {
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
				createElement(ItemDetailModal),
			),
		);
	});
	if (control === undefined) throw new Error("Missing Item Detail control.");
	return {
		readControl: () => {
			if (control === undefined) throw new Error("Missing Item Detail control.");
			return control;
		},
	};
};

describe("ItemDetailModal", () => {
	it("shows a non-zero Queue badge and queued idle line state from live requests", async () => {
		const { readControl } = await renderItemDetail();
		const owner = currentRuntime.items.find((item) => item.item.id === "workshop");
		if (owner === undefined) throw new Error("Missing Workshop runtime item.");

		await act(async () => {
			openItemDetail(readControl(), {
				itemId: owner.id,
			});
			await Promise.resolve();
			await Promise.resolve();
		});
		expect(document.querySelector('[data-ui="ItemDetailQueueTabCount"]')).toBeNull();

		await act(async () => {
			publishRuntime(
				RuntimeSchema.parse({
					...currentRuntime,
					jobQueue: [
						{
							id: "request:workshop:1",
							ownerItemId: owner.id,
							lineId: "line:workshop:water",
						},
						{
							id: "request:workshop:2",
							ownerItemId: owner.id,
							lineId: "line:workshop:water",
						},
					],
				}),
			);
			await Promise.resolve();
		});

		const queueTabBadge = document.querySelector<HTMLElement>(
			'[data-ui="ItemDetailQueueTabCount"]',
		);
		expect(queueTabBadge?.textContent).toBe("2");
		const line = document.querySelector<HTMLElement>('[data-ui="TileLine"]');
		expect(line?.dataset.active).toBe("false");
		expect(line?.dataset.queued).toBe("true");
		expect(line?.querySelector('[data-ui="TileLineQueuedBadge"]')).toBeNull();
		expect(line?.querySelector('[data-ui="TileLineQueuedMessage"]')?.textContent).toContain(
			"Queued for automatic start",
		);

		await act(async () => {
			publishRuntime(
				RuntimeSchema.parse({
					...currentRuntime,
					jobQueue: [],
				}),
			);
			await Promise.resolve();
		});
		expect(document.querySelector('[data-ui="ItemDetailQueueTabCount"]')).toBeNull();
		expect(document.querySelector<HTMLElement>('[data-ui="TileLine"]')?.dataset.queued).toBe(
			"false",
		);
	});

	it("keeps one modal and exact target mounted while switching supported tabs", async () => {
		const { readControl } = await renderItemDetail();
		const owner = currentRuntime.items.find((item) => item.item.id === "workshop");
		if (owner === undefined) throw new Error("Missing Workshop runtime item.");
		const origin = document.createElement("button");
		document.body.append(origin);

		await act(async () => {
			openItemDetail(readControl(), {
				itemId: owner.id,
				origin,
			});
			await Promise.resolve();
			await Promise.resolve();
		});
		const modal = document.querySelector<HTMLElement>('[data-ui="ItemDetailModal"]');
		const openState = readControl().state;
		if (openState.phase !== "open") throw new Error("Missing open Item Detail state.");
		expect(modal).not.toBeNull();
		expect(modal?.dataset.runtimeId).toBe(owner.id);
		expect(modal?.dataset.tab).toBe("lines");
		expect(document.querySelector('[data-ui="ItemLinesTab"]')).not.toBeNull();
		const contentScene = document.querySelector<HTMLElement>(
			'[data-ui="ItemDetailContentScene"]',
		);
		const header = document.querySelector<HTMLElement>("header");
		const headerArtwork = document.querySelector<HTMLElement>(
			'[data-ui="ItemDetailHeaderArtwork"]',
		);
		const tabs = document.querySelector<HTMLElement>('[data-ui="ItemDetailTabs"]');
		const linesBody = document.querySelector<HTMLElement>(
			'[data-ui="ItemDetailContentTransition"]',
		);
		const closeButton = document.querySelector<HTMLButtonElement>(
			'[data-ui="ItemDetailCloseButton"]',
		);
		expect(contentScene).not.toBeNull();
		expect(header).not.toBeNull();
		expect(headerArtwork).not.toBeNull();
		expect(tabs).not.toBeNull();
		expect(linesBody?.dataset.tab).toBe("lines");
		expect(closeButton?.innerHTML).toContain("size-10");
		expect(
			Array.from(
				document.querySelectorAll<HTMLElement>('[data-ui="ItemDetailTabs"] button'),
			).map((tab) => tab.dataset.tab),
		).toEqual([
			"lines",
			"queue",
			"info",
		]);
		const renderedLineCount = document.querySelectorAll('[data-ui="TileLine"]').length;
		expect(
			document.querySelector<HTMLElement>('[data-ui="ItemDetailTabCount"]')?.textContent,
		).toBe(String(renderedLineCount));

		const linesSearch = document.querySelector<HTMLInputElement>(
			'[aria-label="Search visible lines"]',
		);
		if (linesSearch === null) throw new Error("Missing Lines search input.");
		const valueSetter = Object.getOwnPropertyDescriptor(
			HTMLInputElement.prototype,
			"value",
		)?.set;
		if (valueSetter === undefined) throw new Error("Expected native input value setter.");
		await act(async () => {
			valueSetter.call(linesSearch, "definitely-no-line");
			linesSearch.dispatchEvent(
				new Event("input", {
					bubbles: true,
				}),
			);
		});
		expect(document.querySelectorAll('[data-ui="TileLine"]')).toHaveLength(0);
		expect(
			document.querySelector<HTMLElement>('[data-ui="ItemDetailTabCount"]')?.textContent,
		).toBe(String(renderedLineCount));

		const infoTab = document.querySelector<HTMLButtonElement>('[data-tab="info"]');
		if (infoTab === null) throw new Error("Missing Info tab.");
		await act(async () => infoTab.click());
		expect(document.querySelector('[data-ui="ItemDetailModal"]')).toBe(modal);
		expect(document.querySelector('[data-ui="ItemDetailContentScene"]')).toBe(contentScene);
		expect(document.querySelector("header")).toBe(header);
		expect(document.querySelector('[data-ui="ItemDetailHeaderArtwork"]')).toBe(headerArtwork);
		expect(document.querySelector('[data-ui="ItemDetailTabs"]')).toBe(tabs);
		expect(document.querySelector('[data-ui="ItemDetailCloseButton"]')).toBe(closeButton);
		expect(modal?.dataset.tab).toBe("info");
		expect(document.querySelector('[data-ui="ItemInfoTab"]')).not.toBeNull();
		const infoBody = document.querySelector<HTMLElement>(
			'[data-ui="ItemDetailContentTransition"]',
		);
		expect(infoBody).not.toBe(linesBody);
		expect(infoBody?.dataset.tab).toBe("info");
		expect(document.querySelectorAll('[data-ui="ItemDetailContentTransition"]')).toHaveLength(
			1,
		);

		const queueTab = document.querySelector<HTMLButtonElement>('[data-tab="queue"]');
		if (queueTab === null) throw new Error("Missing Queue tab.");
		await act(async () => queueTab.click());
		expect(document.querySelector('[data-ui="ItemDetailModal"]')).toBe(modal);
		expect(document.querySelector('[data-ui="ItemDetailContentScene"]')).toBe(contentScene);
		expect(document.querySelector("header")).toBe(header);
		expect(document.querySelector('[data-ui="ItemDetailHeaderArtwork"]')).toBe(headerArtwork);
		expect(document.querySelector('[data-ui="ItemDetailTabs"]')).toBe(tabs);
		expect(document.querySelector('[data-ui="ItemDetailCloseButton"]')).toBe(closeButton);
		expect(modal?.dataset.tab).toBe("queue");
		expect(document.querySelector('[data-ui="ItemQueueTab"]')).not.toBeNull();
		const queueBody = document.querySelector<HTMLElement>(
			'[data-ui="ItemDetailContentTransition"]',
		);
		expect(queueBody).not.toBe(infoBody);
		expect(queueBody?.dataset.tab).toBe("queue");
		expect(document.querySelectorAll('[data-ui="ItemDetailContentTransition"]')).toHaveLength(
			1,
		);
		expect(readControl().state).toMatchObject({
			phase: "open",
			generation: openState.generation,
			target: {
				itemId: owner.id,
				tab: "queue",
				origin,
			},
		});

		const linesTab = document.querySelector<HTMLButtonElement>('[data-tab="lines"]');
		if (linesTab === null) throw new Error("Missing Lines tab.");
		await act(async () => {
			infoTab.click();
			linesTab.click();
			infoTab.click();
		});
		expect(document.querySelector('[data-ui="ItemDetailModal"]')).toBe(modal);
		expect(document.querySelector('[data-ui="ItemDetailContentScene"]')).toBe(contentScene);
		expect(document.querySelector("header")).toBe(header);
		expect(document.querySelector('[data-ui="ItemDetailTabs"]')).toBe(tabs);
		expect(document.querySelectorAll('[data-ui="ItemDetailContentTransition"]')).toHaveLength(
			1,
		);
		expect(
			document.querySelector<HTMLElement>('[data-ui="ItemDetailContentTransition"]')?.dataset
				.tab,
		).toBe("info");
		expect(document.querySelector('[data-ui="ItemInfoTab"]')).not.toBeNull();
		expect(readControl().state).toMatchObject({
			phase: "open",
			generation: openState.generation,
			target: {
				itemId: owner.id,
				tab: "info",
				origin,
			},
		});
	});

	it("keeps output recipes definition scoped even when a live item exists", async () => {
		const { readControl } = await renderItemDetail();
		const owner = currentRuntime.items.find((item) => item.item.id === "workshop");
		const output = currentRuntime.items.find((item) => item.item.id === "water");
		if (owner === undefined || output === undefined)
			throw new Error("Missing detail fixtures.");

		await act(async () => {
			openItemDetail(readControl(), {
				itemId: owner.id,
			});
			await Promise.resolve();
			await Promise.resolve();
		});
		const modal = document.querySelector<HTMLElement>('[data-ui="ItemDetailModal"]');
		const shellGeneration = readControl().state;
		if (modal === null || shellGeneration.phase !== "open") {
			throw new Error("Missing open Item Detail modal.");
		}
		const outputLink = document.querySelector<HTMLButtonElement>(
			'[data-ui="TileLineOutputDetailLink"][data-detail-available="true"]',
		);
		if (outputLink === null) throw new Error("Missing clickable output artwork.");

		await act(async () => {
			outputLink.click();
			await Promise.resolve();
		});

		expect(document.querySelector('[data-ui="ItemDetailModal"]')).toBe(modal);
		expect(readControl().state).toMatchObject({
			phase: "open",
			generation: shellGeneration.generation,
			target: {
				kind: "definition",
				itemId: "water",
				tab: "sources",
			},
		});
		expect(modal.dataset.runtimeId).toBeUndefined();
		expect(document.querySelector('[data-ui="ItemSource"]')?.textContent).toContain("Workshop");
		expect(
			Array.from(
				document.querySelectorAll<HTMLElement>('[data-ui="ItemDetailTabs"] button'),
			).map((tab) => tab.dataset.tab),
		).toEqual([
			"sources",
			"info",
		]);

		const infoTab = document.querySelector<HTMLButtonElement>('[data-tab="info"]');
		if (infoTab === null) throw new Error("Missing definition Info tab.");
		await act(async () => {
			infoTab.click();
			await Promise.resolve();
		});
		expect(readControl().state).toMatchObject({
			phase: "open",
			generation: shellGeneration.generation,
			target: {
				kind: "definition",
				itemId: "water",
				tab: "info",
			},
		});
		expect(modal.dataset.runtimeId).toBeUndefined();
		expect(document.querySelector('[data-ui="ItemDefinitionInfoTab"]')).not.toBeNull();
	});

	it("keeps the modal shell stable when an output has only configured definition detail", async () => {
		const owner = currentRuntime.items.find((item) => item.item.id === "workshop");
		if (owner === undefined) throw new Error("Missing Workshop runtime item.");
		publishRuntime(
			RuntimeSchema.parse({
				...currentRuntime,
				items: currentRuntime.items.filter((item) => item.item.id !== "water"),
			}),
		);
		const { readControl } = await renderItemDetail();

		await act(async () => {
			openItemDetail(readControl(), {
				itemId: owner.id,
			});
			await Promise.resolve();
			await Promise.resolve();
		});
		const modal = document.querySelector<HTMLElement>('[data-ui="ItemDetailModal"]');
		if (modal === null) throw new Error("Missing Item Detail modal.");
		const outputLink = document.querySelector<HTMLButtonElement>(
			'[data-ui="TileLineOutputDetailLink"][data-detail-available="true"]',
		);
		if (outputLink === null) throw new Error("Missing configured output detail link.");

		await act(async () => {
			outputLink.click();
			await Promise.resolve();
		});

		expect(document.querySelector('[data-ui="ItemDetailModal"]')).toBe(modal);
		expect(readControl().state).toMatchObject({
			phase: "open",
			target: {
				kind: "definition",
				itemId: "water",
				tab: "sources",
			},
		});
		expect(modal.dataset.targetKind).toBe("definition");
		expect(modal.dataset.runtimeId).toBeUndefined();
		expect(modal.dataset.tab).toBe("sources");
		expect(document.querySelector('[data-ui="ItemSource"]')?.textContent).toContain("Workshop");
	});

	it("sets and retains one save-backed default line through the canonical command boundary", async () => {
		const { readControl } = await renderItemDetail();
		const owner = currentRuntime.items.find((item) => item.item.id === "workshop");
		if (owner === undefined) throw new Error("Missing Workshop runtime item.");
		const runFx = vi
			.spyOn(game, "runFx")
			.mockImplementationOnce((() =>
				Effect.sync(() => {
					publishRuntime(
						RuntimeSchema.parse({
							...currentRuntime,
							defaultLineByOwnerItemId: {
								[owner.id]: "line:workshop:water",
							},
						}),
					);
					return {
						ownerItemId: owner.id,
						lineId: "line:workshop:water",
					};
				})) as GameEngine["runFx"])
			.mockImplementationOnce((() =>
				Effect.sync(() => {
					publishRuntime(
						RuntimeSchema.parse({
							...currentRuntime,
							defaultLineByOwnerItemId: {},
						}),
					);
					return {
						ownerItemId: owner.id,
					};
				})) as GameEngine["runFx"]);

		await act(async () => {
			openItemDetail(readControl(), {
				itemId: owner.id,
			});
			await Promise.resolve();
			await Promise.resolve();
		});
		const button = document.querySelector<HTMLButtonElement>(
			'[data-ui="TileLineSetDefaultButton"]',
		);
		if (button === null) throw new Error("Missing Set default button.");
		expect(button.textContent).toBe("Set default");

		await act(async () => {
			button.click();
			await Promise.resolve();
			await Promise.resolve();
		});

		expect(runFx).toHaveBeenCalledTimes(1);
		expect(document.querySelector('[data-ui="TileLineDefaultBadge"]')?.textContent).toBe(
			"Default",
		);
		const unsetButton = document.querySelector<HTMLButtonElement>(
			'[data-ui="TileLineSetDefaultButton"]',
		);
		if (unsetButton === null) throw new Error("Missing Unset default button.");
		expect(unsetButton.disabled).toBe(false);
		expect(unsetButton.textContent).toBe("Unset default");

		await act(async () => {
			unsetButton.click();
			await Promise.resolve();
			await Promise.resolve();
		});

		expect(runFx).toHaveBeenCalledTimes(2);
		expect(document.querySelector('[data-ui="TileLineDefaultBadge"]')).toBeNull();
		expect(
			document.querySelector<HTMLButtonElement>('[data-ui="TileLineSetDefaultButton"]')
				?.textContent,
		).toBe("Set default");
	});

	it("allows tab switches while pending work settles against its command key", async () => {
		const { readControl } = await renderItemDetail();
		const owner = currentRuntime.items.find((item) => item.item.id === "workshop");
		if (owner === undefined) throw new Error("Missing Workshop runtime item.");
		let rejectRun: ((cause: Error) => void) | undefined;
		const pendingRun = new Promise<never>((_resolve, reject) => {
			rejectRun = reject;
		});
		const runFx = vi.spyOn(game, "runFx").mockImplementationOnce((() =>
			Effect.tryPromise({
				try: () => pendingRun,
				catch: (cause) => cause,
			})) as GameEngine["runFx"]);

		await act(async () => {
			openItemDetail(readControl(), {
				itemId: owner.id,
			});
			await Promise.resolve();
			await Promise.resolve();
		});
		const setDefault = document.querySelector<HTMLButtonElement>(
			'[data-ui="TileLineSetDefaultButton"]',
		);
		if (setDefault === null) throw new Error("Missing Set default button.");

		await act(async () => {
			setDefault.click();
			await Promise.resolve();
		});
		expect(setDefault.disabled).toBe(false);
		expect(setDefault.textContent).toBe("Saving…");
		expect(runFx).toHaveBeenCalledTimes(1);

		const infoTab = document.querySelector<HTMLButtonElement>('[data-tab="info"]');
		if (infoTab === null) throw new Error("Missing Info tab.");
		await act(async () => infoTab.click());
		expect(readControl().state).toMatchObject({
			target: {
				tab: "info",
			},
		});
		expect(document.querySelector('[data-ui="TileLineSetDefaultButton"]')).toBeNull();

		await act(async () => {
			rejectRun?.(new Error("Deferred default failure."));
			await Promise.resolve();
			await Promise.resolve();
		});
		const linesTab = document.querySelector<HTMLButtonElement>('[data-tab="lines"]');
		if (linesTab === null) throw new Error("Missing Lines tab.");
		await act(async () => linesTab.click());
		expect(
			document.querySelector<HTMLButtonElement>('[data-ui="TileLineSetDefaultButton"]')
				?.disabled,
		).toBe(false);
		expect(document.querySelector('[data-ui="TileLine"]')?.textContent).toContain(
			"Deferred default failure.",
		);
	});

	it("counts active work down in the fixed runtime slot without adding a layout row", async () => {
		const { readControl } = await renderItemDetail();
		const owner = currentRuntime.items.find((item) => item.item.id === "workshop");
		if (owner === undefined) throw new Error("Missing Workshop runtime item.");

		await act(async () => {
			publishRuntime(
				RuntimeSchema.parse({
					...currentRuntime,
					jobs: [
						{
							id: "job:workshop",
							ownerItemId: owner.id,
							lineId: "line:workshop:water",
							durationMs: 1_000,
							remainingMs: 400,
						},
					],
				}),
			);
			openItemDetail(readControl(), {
				itemId: owner.id,
			});
			await Promise.resolve();
			await Promise.resolve();
		});

		const runtime = document.querySelector<HTMLElement>('[data-ui="TileLineRuntime"]');
		if (runtime === null) throw new Error("Missing line runtime slot.");
		expect(runtime.dataset.jobStatus).toBe(JobStatusEnumSchema.enum.Running);
		expect(document.querySelector('[data-ui="TileLine"]')?.textContent).not.toContain(
			"Running",
		);
		expect(document.querySelector('[data-ui="TileLineRuntimeValue"]')?.textContent).toBe(
			"0.4 s",
		);
		expect(document.querySelector('[data-ui="TileLineRuntimeDetail"]')?.textContent).toBe(
			"Remaining of 1 s",
		);
		expect(document.body.textContent).not.toContain("Current work");

		await act(async () => {
			publishRuntime(
				RuntimeSchema.parse({
					...currentRuntime,
					jobs: currentRuntime.jobs.map((job) => ({
						...job,
						remainingMs: 200,
					})),
				}),
			);
			await Promise.resolve();
		});

		expect(document.querySelector('[data-ui="TileLineRuntime"]')).toBe(runtime);
		expect(document.querySelector('[data-ui="TileLineRuntimeValue"]')?.textContent).toBe(
			"0.2 s",
		);

		await act(async () => {
			publishRuntime(
				RuntimeSchema.parse({
					...currentRuntime,
					jobs: currentRuntime.jobs.map((job) => ({
						...job,
						remainingMs: 0,
					})),
				}),
			);
			await Promise.resolve();
		});

		expect(document.querySelector('[data-ui="TileLineRuntime"]')).toBe(runtime);
		expect(runtime.dataset.jobStatus).toBe(JobStatusEnumSchema.enum.AwaitingOutput);
		expect(document.querySelector('[data-ui="TileLineRuntimeValue"]')?.textContent).toBe(
			"Complete",
		);
		expect(document.querySelector('[data-ui="TileLineRuntimeDetail"]')?.textContent).toBe(
			"Awaiting output",
		);
	});

	it("keeps an occupied single-slot line labeled Start and disables it", async () => {
		const { readControl } = await renderItemDetail();
		const owner = currentRuntime.items.find((item) => item.item.id === "workshop");
		if (owner === undefined || owner.item.type !== "producer")
			throw new Error("Missing Workshop producer runtime item.");

		await act(async () => {
			publishRuntime(
				RuntimeSchema.parse({
					...currentRuntime,
					items: currentRuntime.items.map((item) =>
						item.id === owner.id && item.item.type === "producer"
							? {
									...item,
									item: {
										...item.item,
										maxQueueSize: 1,
									},
								}
							: item,
					),
					jobs: [
						{
							id: "job:workshop",
							ownerItemId: owner.id,
							lineId: "line:workshop:water",
							durationMs: 1_000,
							remainingMs: 400,
						},
					],
				}),
			);
			openItemDetail(readControl(), {
				itemId: owner.id,
			});
			await Promise.resolve();
			await Promise.resolve();
		});

		const enqueueButton = document.querySelector<HTMLButtonElement>(
			'[data-ui="TileLineEnqueueButton"]',
		);
		expect(enqueueButton?.textContent).toBe("Enqueue");
		expect(enqueueButton?.disabled).toBe(true);
		const queueTab = document.querySelector<HTMLButtonElement>('[data-tab="queue"]');
		if (queueTab === null) throw new Error("Missing single-slot Queue tab.");
		await act(async () => {
			queueTab.click();
			await Promise.resolve();
		});
		const activeRow = document.querySelector<HTMLElement>(
			'[data-ui="ItemQueueRow"][data-state="active"]',
		);
		expect(activeRow?.textContent).toContain("Water");
		expect(activeRow?.textContent).not.toContain("Running");
		expect(
			activeRow?.querySelector<HTMLImageElement>('[data-ui="ItemQueueWorkIdentity"] img')
				?.src,
		).toContain("resource:asset:water");
		expect(
			activeRow?.querySelector<HTMLElement>('[data-ui="ItemQueueProgressFill"]')?.style.width,
		).toBe("60%");
		expect(activeRow?.querySelector('[data-ui="ItemQueueRuntimeValue"]')?.textContent).toBe(
			"0.4 s",
		);
		expect(activeRow?.querySelector('[data-ui="ItemQueueRuntimeDetail"]')?.textContent).toBe(
			"Remaining of 1 s",
		);
		expect(document.querySelector('[data-ui="ItemQueueRow"][data-state="queued"]')).toBeNull();
		const activeSlot = document.querySelector('[data-ui="ItemQueueActiveSlot"]');

		await act(async () => {
			publishRuntime(
				RuntimeSchema.parse({
					...currentRuntime,
					items: currentRuntime.items.map((item) =>
						item.id === owner.id && item.item.type === "producer"
							? {
									...item,
									item: {
										...item.item,
										maxQueueSize: 2,
									},
								}
							: item,
					),
					jobQueue: [
						{
							id: "request:workshop",
							ownerItemId: owner.id,
							lineId: "line:workshop:water",
						},
					],
				}),
			);
			await Promise.resolve();
		});
		const queuedRow = document.querySelector<HTMLElement>(
			'[data-ui="ItemQueueRow"][data-state="queued"]',
		);
		expect(queuedRow?.textContent).toContain("Water");
		expect(queuedRow?.textContent).toContain("Queued #1");
		expect(
			queuedRow?.querySelector<HTMLImageElement>('[data-ui="ItemQueueWorkIdentity"] img')
				?.src,
		).toContain("resource:asset:water");
		expect(queuedRow?.querySelector("button")).toBeNull();
		const clearQueueButton = document.querySelector<HTMLButtonElement>(
			'[data-ui="ItemQueueClearButton"]',
		);
		expect(clearQueueButton).not.toBeNull();
		expect(document.querySelectorAll('[data-ui="ItemQueueClearButton"]')).toHaveLength(1);
		expect(document.querySelector('[data-ui="ItemQueueEmptyState"]')).toBeNull();

		await act(async () => {
			publishRuntime(
				RuntimeSchema.parse({
					...currentRuntime,
					jobQueue: [],
					jobs: [],
				}),
			);
			await Promise.resolve();
		});
		expect(document.querySelector('[data-ui="ItemQueueActiveSlot"]')).toBe(activeSlot);
		expect(document.querySelector('[data-ui="ItemQueueIdleSlot"]')?.textContent).toContain(
			"No active job",
		);
		expect(document.querySelector('[data-ui="ItemQueueIdleSlot"]')?.textContent).toContain(
			"Nothing is currently scheduled to run.",
		);
		const emptyQueue = document.querySelector('[data-ui="ItemQueueEmptyState"]');
		expect(emptyQueue?.textContent).toContain("Queue is empty");
		expect(document.querySelector('[data-ui="ItemQueueRow"]')).toBeNull();
		expect(document.querySelector('[data-ui="ItemQueueClearButton"]')).toBeNull();
	});

	it("shows exact owned sources and hands off through the stable modal shell", async () => {
		const { readControl } = await renderItemDetail();
		const owner = currentRuntime.items.find((item) => item.item.id === "workshop");
		const target = currentRuntime.items.find((item) => item.item.id === "water");
		if (owner === undefined || target === undefined)
			throw new Error("Missing source fixtures.");

		await act(async () => {
			openItemDetail(readControl(), {
				itemId: target.id,
			});
			await Promise.resolve();
			await Promise.resolve();
		});

		const modal = document.querySelector<HTMLElement>('[data-ui="ItemDetailModal"]');
		if (modal === null) throw new Error("Missing Item Detail modal.");
		expect(modal.dataset.tab).toBe("sources");
		expect(
			Array.from(
				document.querySelectorAll<HTMLElement>('[data-ui="ItemDetailTabs"] button'),
			).map((tab) => tab.dataset.tab),
		).toEqual([
			"sources",
			"info",
		]);
		expect(document.querySelector('[data-ui="ItemSource"]')?.textContent).toContain("Workshop");
		expect(document.querySelector('[data-ui="ItemSource"]')?.textContent).toContain("Space 1");
		expect(document.querySelector('[data-ui="ItemSourceLine"]')).toBeNull();

		const sourceLink = document.querySelector<HTMLButtonElement>(
			'[data-ui="ItemSourceDetailLink"]',
		);
		if (sourceLink === null) throw new Error("Missing clickable source.");
		await act(async () => {
			sourceLink.click();
			await Promise.resolve();
		});

		expect(document.querySelector('[data-ui="ItemDetailModal"]')).toBe(modal);
		expect(readControl().state).toMatchObject({
			phase: "open",
			target: {
				kind: "runtime",
				itemId: owner.id,
				tab: "lines",
				linesSearchQuery: "Water",
			},
		});
		expect(document.querySelector('[data-ui="ItemLinesTab"]')).not.toBeNull();
		expect(
			document.querySelector<HTMLInputElement>('[aria-label="Search visible lines"]')?.value,
		).toBe("Water");
	});

	it("closes immediately while an admitted autofill command keeps settling", async () => {
		const { readControl } = await renderItemDetail();
		const owner = currentRuntime.items.find((item) => item.item.id === "workshop");
		if (owner === undefined) throw new Error("Missing Workshop runtime item.");

		await act(async () => {
			openItemDetail(readControl(), {
				itemId: owner.id,
				tab: "lines",
			});
			await Promise.resolve();
			await Promise.resolve();
		});
		const settlement = Effect.runSync(Deferred.make<void>());
		await act(async () => {
			readControl().runPendingAction({
				key: "line:autofill",
				action: "autofill",
				failureMessage: "Autofill failed.",
				run: Deferred.await(settlement),
			});
			await Promise.resolve();
		});
		expect(readControl().readPendingAction("line:autofill")).toBe("autofill");

		const closeButton = document.querySelector<HTMLButtonElement>(
			'button[aria-label="Close item detail"]',
		);
		if (closeButton === null) throw new Error("Missing Item Detail close button.");
		expect(closeButton.disabled).toBe(false);
		await act(async () => {
			closeButton.click();
			await Promise.resolve();
			await Promise.resolve();
		});

		expect(readControl().state.phase).toBe("closed");
		expect(readControl().readPendingAction("line:autofill")).toBe("autofill");
		await act(async () => {
			Effect.runSync(Deferred.succeed(settlement, undefined));
		});
		await vi.waitFor(() => expect(readControl().readPendingAction("line:autofill")).toBeNull());
		expect(readControl().readPendingAction("line:autofill")).toBeNull();
	});

	it("keeps an owned Source discoverable when its last owner moves off the Board", async () => {
		const { readControl } = await renderItemDetail();
		const owner = currentRuntime.items.find((item) => item.item.id === "workshop");
		const target = currentRuntime.items.find((item) => item.item.id === "water");
		if (owner === undefined || target === undefined)
			throw new Error("Missing source fixtures.");

		await act(async () => {
			openItemDetail(readControl(), {
				itemId: target.id,
				tab: "sources",
			});
			await Promise.resolve();
			await Promise.resolve();
		});
		const modal = document.querySelector<HTMLElement>('[data-ui="ItemDetailModal"]');
		if (modal === null) throw new Error("Missing Item Detail modal.");

		await act(async () => {
			publishRuntime(
				RuntimeSchema.parse({
					...currentRuntime,
					items: currentRuntime.items.map((item) =>
						item.id === owner.id
							? {
									...item,
									location: {
										scope: "inventory",
										position: {
											x: 0,
											y: 0,
										},
									},
								}
							: item,
					),
				}),
			);
			await Promise.resolve();
			await Promise.resolve();
		});

		expect(document.querySelector('[data-ui="ItemDetailModal"]')).toBe(modal);
		expect(modal.dataset.tab).toBe("sources");
		expect(document.querySelector('[data-ui="ItemSource"]')?.textContent).toContain(
			"Owned source",
		);
		expect(
			Array.from(
				document.querySelectorAll<HTMLElement>('[data-ui="ItemDetailTabs"] button'),
			).map((tab) => tab.dataset.tab),
		).toEqual([
			"sources",
			"info",
		]);

		await act(async () => {
			publishRuntime(
				RuntimeSchema.parse({
					...currentRuntime,
					items: currentRuntime.items.filter((item) => item.id !== owner.id),
				}),
			);
			await Promise.resolve();
			await Promise.resolve();
		});

		expect(modal.dataset.tab).toBe("info");
		expect(document.querySelector('[data-tab="sources"]')).toBeNull();
	});

	it("removes definition Sources when the player loses the last source owner", async () => {
		const { readControl } = await renderItemDetail();
		const owner = currentRuntime.items.find((item) => item.item.id === "workshop");
		if (owner === undefined) throw new Error("Missing source fixture.");

		await act(async () => {
			openItemDefinitionDetail(readControl(), {
				itemId: "water",
			});
			await Promise.resolve();
			await Promise.resolve();
		});
		const modal = document.querySelector<HTMLElement>('[data-ui="ItemDetailModal"]');
		if (modal === null) throw new Error("Missing Item Detail modal.");
		expect(modal.dataset.targetKind).toBe("definition");
		expect(modal.dataset.tab).toBe("sources");

		await act(async () => {
			publishRuntime(
				RuntimeSchema.parse({
					...currentRuntime,
					items: currentRuntime.items.filter((item) => item.id !== owner.id),
				}),
			);
			await Promise.resolve();
			await Promise.resolve();
		});

		expect(document.querySelector('[data-ui="ItemDetailModal"]')).toBe(modal);
		expect(modal.dataset.targetKind).toBe("definition");
		expect(modal.dataset.tab).toBe("info");
		expect(document.querySelector('[data-ui="ItemSource"]')).toBeNull();
		expect(document.querySelector('[data-tab="sources"]')).toBeNull();
		expect(document.querySelector('[data-ui="ItemDefinitionInfoTab"]')).not.toBeNull();
	});

	it("retains stale Sources navigation when the inspected target disappears", async () => {
		const { readControl } = await renderItemDetail();
		const target = currentRuntime.items.find((item) => item.item.id === "water");
		if (target === undefined) throw new Error("Missing target fixture.");

		await act(async () => {
			openItemDetail(readControl(), {
				itemId: target.id,
				tab: "sources",
			});
			await Promise.resolve();
			await Promise.resolve();
		});
		expect(document.querySelector('[data-ui="ItemSource"]')).not.toBeNull();

		await act(async () => {
			publishRuntime(
				RuntimeSchema.parse({
					...currentRuntime,
					items: currentRuntime.items.filter((item) => item.id !== target.id),
				}),
			);
			await Promise.resolve();
			await Promise.resolve();
		});

		expect(document.querySelector('[data-ui="ItemSource"]')).not.toBeNull();
		const sourceLink = document.querySelector<HTMLButtonElement>(
			'[data-ui="ItemSourceDetailLink"]',
		);
		expect(sourceLink?.disabled).toBe(false);
		expect(document.querySelector('[data-ui="ItemSource"]')?.textContent).not.toContain(
			"Space 1",
		);
		expect(
			document.querySelector<HTMLElement>('[data-ui="ItemDetailContentScene"]')?.dataset
				.stale,
		).toBe("true");
	});

	it("keeps retained navigation and search while removing stale facts and commands", async () => {
		const { readControl } = await renderItemDetail();
		const owner = currentRuntime.items.find((item) => item.item.id === "workshop");
		if (owner === undefined) throw new Error("Missing Workshop runtime item.");

		await act(async () => {
			openItemDetail(readControl(), {
				itemId: owner.id,
			});
			await Promise.resolve();
			await Promise.resolve();
		});
		const modal = document.querySelector<HTMLElement>('[data-ui="ItemDetailModal"]');
		expect(modal).not.toBeNull();

		await act(async () => {
			publishRuntime(
				RuntimeSchema.parse({
					...currentRuntime,
					items: currentRuntime.items.filter((item) => item.id !== owner.id),
				}),
			);
			await Promise.resolve();
			await Promise.resolve();
		});

		expect(readControl().state.phase).toBe("open");
		expect(document.querySelector('[data-ui="ItemDetailModal"]')).toBe(modal);
		expect(
			document.querySelector<HTMLElement>('[data-ui="ItemDetailContentScene"]')?.dataset
				.stale,
		).toBe("true");
		expect(document.body.textContent).toContain("This item no longer exists");
		expect(
			Array.from(
				document.querySelectorAll<HTMLButtonElement>('[data-ui="ItemDetailTabs"] button'),
			).every((button) => !button.disabled),
		).toBe(true);
		expect(document.querySelector('[data-ui="TileLineRuntime"]')).toBeNull();
		expect(document.querySelector('[data-ui="TileLineProgress"]')).toBeNull();
		expect(document.querySelector('[data-ui="ItemLinesAvailabilityFilter"]')).toBeNull();
		const retainedReferences = Array.from(
			document.querySelectorAll<HTMLButtonElement>(
				'[data-ui="TileLineInputDetailLink"], [data-ui="TileLineOutputDetailLink"]',
			),
		);
		expect(retainedReferences.length).toBeGreaterThan(0);
		expect(retainedReferences.every((button) => !button.disabled)).toBe(true);
		expect(
			document.querySelector<HTMLButtonElement>('[data-ui="ItemDetailCloseButton"]')
				?.disabled,
		).toBe(false);

		const staleSearch = document.querySelector<HTMLInputElement>(
			'[aria-label="Search visible lines"]',
		);
		if (staleSearch === null) throw new Error("Missing retained Lines search input.");
		expect(staleSearch.disabled).toBe(false);
		const staleValueSetter = Object.getOwnPropertyDescriptor(
			HTMLInputElement.prototype,
			"value",
		)?.set;
		if (staleValueSetter === undefined) throw new Error("Expected native input value setter.");
		await act(async () => {
			staleValueSetter.call(staleSearch, "definitely-no-line");
			staleSearch.dispatchEvent(
				new Event("input", {
					bubbles: true,
				}),
			);
		});
		expect(document.querySelector('[data-ui="ItemLinesSearchEmpty"]')).not.toBeNull();

		const infoTab = document.querySelector<HTMLButtonElement>('[data-tab="info"]');
		if (infoTab === null) throw new Error("Missing retained Info tab.");
		await act(async () => {
			infoTab.click();
			await Promise.resolve();
		});
		expect(document.querySelector('[data-ui="ItemInfoTab"]')).not.toBeNull();
		expect(document.querySelector('[data-label="Location"]')).toBeNull();
		expect(document.querySelector('[data-label="Current stack"]')).toBeNull();
		expect(document.querySelector('[data-label="Owned"]')).toBeNull();
		expect(document.querySelector('[data-label="Charges"]')).toBeNull();
		expect(document.querySelector('[data-label="Type"]')).not.toBeNull();

		const queueTab = document.querySelector<HTMLButtonElement>('[data-tab="queue"]');
		if (queueTab === null) throw new Error("Missing retained Queue tab.");
		await act(async () => {
			queueTab.click();
			await Promise.resolve();
		});
		expect(document.querySelector('[data-ui="ItemQueueStale"]')).not.toBeNull();
		expect(document.querySelector('[data-ui="ItemQueueRow"]')).toBeNull();
	});
});
