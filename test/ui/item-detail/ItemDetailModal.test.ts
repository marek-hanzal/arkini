// @vitest-environment jsdom

import { Effect } from "effect";
import { act, createElement, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Game } from "~/bridge/game/Game";
import { useGameFx } from "~/engine/game/fx/useGameFx";
import { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { startFx } from "~/engine/start/write/startFx";
import type { ItemDetailControl } from "~/ui/item-detail/ItemDetailControl";
import { ItemDetailModal } from "~/ui/item-detail/ItemDetailModal";
import { ItemDetailProvider } from "~/ui/item-detail/ItemDetailProvider";
import { useItemDetailControl } from "~/ui/item-detail/useItemDetailControl";
import { motionTestRuntime } from "~test/ui/support/motionReactMock";
import { testGameRead } from "~test/support/game/testGameRead";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const gameEngineState = vi.hoisted(() => ({
	game: undefined as Game | undefined,
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
		],
	},
	categories: {},
	items: {
		workshop: {
			id: "workshop",
			type: "producer",
			title: "Workshop",
			description: "Produces water.",
			asset: {
				source: [
					"asset:workshop",
				],
			},
			tags: [],
			categoryId: "building",
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
													type: "value",
													value: 1,
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
			id: "water",
			type: "simple",
			title: "Water",
			description: "Water.",
			asset: {
				source: [
					"asset:water",
				],
			},
			tags: [],
			categoryId: "resource",
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
const publishRuntime = (runtime: RuntimeSchema.Type) => {
	currentRuntime = runtime;
	for (const listener of runtimeListeners) listener();
};

const game = {
	arkpack: {
		packageId: "test-package",
		contentHash: "test-hash",
		gameId: config.meta.id,
		title: config.meta.title,
		configVersion: config.version,
		compressedSize: 0,
		source: "imported" as const,
	},
	config,
	saveKey: {
		packageId: "test-package",
		contentHash: "0".repeat(64),
	},
	getSnapshot: () => currentRuntime,
	getResourceUrl: (resourceId: string) => `resource:${resourceId}`,
	subscribe: (listener: () => void) => {
		runtimeListeners.add(listener);
		return () => runtimeListeners.delete(listener);
	},
	subscribeEvents: () => () => undefined,
	read: testGameRead,
	run: (() => Promise.reject(new Error("Not used by this test."))) as Game["run"],
	disposeFx: Effect.void,
	disposeWithoutSaveFx: Effect.void,
	flushSaveFx: Effect.void,
} satisfies Game;

const roots: Array<ReturnType<typeof createRoot>> = [];

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
				null,
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
	it("keeps one modal and exact target mounted while switching supported tabs", async () => {
		const { readControl } = await renderItemDetail();
		const owner = currentRuntime.items.find((item) => item.item.id === "workshop");
		if (owner === undefined) throw new Error("Missing Workshop runtime item.");
		const origin = document.createElement("button");
		document.body.append(origin);

		await act(async () => {
			readControl().openItemDetail({
				itemId: owner.id,
				origin,
			});
			await Promise.resolve();
			await Promise.resolve();
		});
		const modal = document.querySelector<HTMLElement>('[data-ui="ItemDetailModal"]');
		expect(modal).not.toBeNull();
		expect(modal?.dataset.runtimeId).toBe(owner.id);
		expect(modal?.dataset.tab).toBe("lines");
		expect(document.querySelector('[data-ui="ItemLinesTab"]')).not.toBeNull();
		expect(
			Array.from(
				document.querySelectorAll<HTMLElement>('[data-ui="ItemDetailTabs"] button'),
			).map((tab) => tab.dataset.tab),
		).toEqual([
			"lines",
			"queue",
			"info",
		]);

		const infoTab = document.querySelector<HTMLButtonElement>('[data-tab="info"]');
		if (infoTab === null) throw new Error("Missing Info tab.");
		await act(async () => infoTab.click());
		expect(document.querySelector('[data-ui="ItemDetailModal"]')).toBe(modal);
		expect(modal?.dataset.tab).toBe("info");
		expect(document.querySelector('[data-ui="ItemInfoTab"]')).not.toBeNull();

		const queueTab = document.querySelector<HTMLButtonElement>('[data-tab="queue"]');
		if (queueTab === null) throw new Error("Missing Queue tab.");
		await act(async () => queueTab.click());
		expect(document.querySelector('[data-ui="ItemDetailModal"]')).toBe(modal);
		expect(modal?.dataset.tab).toBe("queue");
		expect(document.querySelector('[data-ui="ItemQueueTab"]')).not.toBeNull();
		expect(readControl().state).toMatchObject({
			phase: "open",
			target: {
				itemId: owner.id,
				tab: "queue",
				origin,
			},
		});
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
			readControl().openItemDetail({
				itemId: owner.id,
			});
			await Promise.resolve();
			await Promise.resolve();
		});

		const runtime = document.querySelector<HTMLElement>('[data-ui="TileLineRuntime"]');
		if (runtime === null) throw new Error("Missing line runtime slot.");
		expect(runtime.dataset.jobStatus).toBe("running");
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
		expect(runtime.dataset.jobStatus).toBe("ready");
		expect(document.querySelector('[data-ui="TileLineRuntimeValue"]')?.textContent).toBe(
			"Complete",
		);
		expect(document.querySelector('[data-ui="TileLineRuntimeDetail"]')?.textContent).toBe(
			"Awaiting output",
		);
	});

	it("restores focus only to a still-focusable exact origin", async () => {
		const { readControl } = await renderItemDetail();
		const owner = currentRuntime.items.find((item) => item.item.id === "workshop");
		if (owner === undefined) throw new Error("Missing Workshop runtime item.");
		const shell = document.createElement("div");
		shell.dataset.ui = "GameShell";
		shell.tabIndex = -1;
		document.body.append(shell);
		const origin = document.createElement("button");
		document.body.append(origin);

		await act(async () => {
			readControl().openItemDetail({
				itemId: owner.id,
				tab: "info",
				origin,
			});
			await Promise.resolve();
			await Promise.resolve();
		});
		origin.disabled = true;
		const closeButton = document.querySelector<HTMLButtonElement>(
			'button[aria-label="Close item detail"]',
		);
		if (closeButton === null) throw new Error("Missing Item Detail close button.");
		await act(async () => {
			closeButton.click();
			await Promise.resolve();
			await Promise.resolve();
		});

		expect(readControl().state.phase).toBe("closed");
		expect(document.activeElement).toBe(shell);
	});

	it("closes the exact stale target without retargeting another item", async () => {
		const { readControl } = await renderItemDetail();
		const owner = currentRuntime.items.find((item) => item.item.id === "workshop");
		if (owner === undefined) throw new Error("Missing Workshop runtime item.");

		await act(async () => {
			readControl().openItemDetail({
				itemId: owner.id,
				tab: "info",
			});
			await Promise.resolve();
			await Promise.resolve();
		});
		expect(document.querySelector('[data-ui="ItemDetailModal"]')).not.toBeNull();

		await act(async () => {
			publishRuntime(
				RuntimeSchema.parse({
					...currentRuntime,
					items: currentRuntime.items.filter((item) => item.id !== owner.id),
				}),
			);
			await Promise.resolve();
			await Promise.resolve();
			await Promise.resolve();
		});
		expect(readControl().state.phase).toBe("closed");
		expect(document.querySelector('[data-ui="ItemDetailModal"]')).toBeNull();
	});
});
