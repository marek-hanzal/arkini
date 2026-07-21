// @vitest-environment jsdom

import { Effect } from "effect";
import { act, createElement, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GameEngine } from "~/bridge/game/GameEngine";
import { useGameFx } from "~/engine/game/fx/useGameFx";
import { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { startFx } from "~/engine/start/write/startFx";
import type { ItemDetailControl } from "~/ui/item-detail/ItemDetailControl";
import { ItemDetailModal } from "~/ui/item-detail/ItemDetailModal";
import { ItemDetailProvider } from "~/ui/item-detail/ItemDetailProvider";
import { useItemDetailControl } from "~/ui/item-detail/useItemDetailControl";
import { motionTestRuntime } from "~test/ui/support/motionReactMock";
import { testGameRead, testGameReadOrThrow } from "~test/support/game/testGameRead";

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
	readOrThrow: testGameReadOrThrow,
	run: (() => Promise.reject(new Error("Not used by this test."))) as GameEngine["run"],
	disposeFx: Effect.void,
	disposeWithoutSaveFx: Effect.void,
	flushSaveFx: Effect.void,
} satisfies GameEngine;

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

	it("keeps the modal shell stable when an output artwork opens another exact item", async () => {
		const { readControl } = await renderItemDetail();
		const owner = currentRuntime.items.find((item) => item.item.id === "workshop");
		const output = currentRuntime.items.find((item) => item.item.id === "water");
		if (owner === undefined || output === undefined)
			throw new Error("Missing detail fixtures.");

		await act(async () => {
			readControl().openItemDetail({
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
				itemId: output.id,
				tab: "info",
			},
		});
		expect(modal.dataset.runtimeId).toBe(output.id);
		expect(document.querySelector('[data-ui="ItemInfoTab"]')).not.toBeNull();
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
			readControl().openItemDetail({
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
				tab: "info",
			},
		});
		expect(modal.dataset.targetKind).toBe("definition");
		expect(modal.dataset.runtimeId).toBeUndefined();
		expect(document.querySelector('[data-ui="ItemDefinitionInfoTab"]')).not.toBeNull();
	});

	it("sets and retains one save-backed default line through the canonical command boundary", async () => {
		const { readControl } = await renderItemDetail();
		const owner = currentRuntime.items.find((item) => item.item.id === "workshop");
		if (owner === undefined) throw new Error("Missing Workshop runtime item.");
		const run = vi
			.spyOn(game, "run")
			.mockImplementationOnce((() => {
				publishRuntime(
					RuntimeSchema.parse({
						...currentRuntime,
						defaultLineByOwnerItemId: {
							[owner.id]: "line:workshop:water",
						},
					}),
				);
				return Promise.resolve({
					ownerItemId: owner.id,
					lineId: "line:workshop:water",
				});
			}) as GameEngine["run"])
			.mockImplementationOnce((() => {
				publishRuntime(
					RuntimeSchema.parse({
						...currentRuntime,
						defaultLineByOwnerItemId: undefined,
					}),
				);
				return Promise.resolve({
					ownerItemId: owner.id,
				});
			}) as GameEngine["run"]);

		await act(async () => {
			readControl().openItemDetail({
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

		expect(run).toHaveBeenCalledTimes(1);
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

		expect(run).toHaveBeenCalledTimes(2);
		expect(document.querySelector('[data-ui="TileLineDefaultBadge"]')).toBeNull();
		expect(
			document.querySelector<HTMLButtonElement>('[data-ui="TileLineSetDefaultButton"]')
				?.textContent,
		).toBe("Set default");
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
		expect(runtime.dataset.jobStatus).toBe("awaiting-output");
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
			readControl().openItemDetail({
				itemId: owner.id,
			});
			await Promise.resolve();
			await Promise.resolve();
		});

		const startButton = document.querySelector<HTMLButtonElement>(
			'[data-ui="TileLineStartButton"]',
		);
		if (startButton === null) throw new Error("Missing line Start button.");
		expect(startButton.dataset.startMode).toBe("start");
		expect(startButton.textContent).toBe("Start");
		expect(startButton.disabled).toBe(true);
		expect(document.body.textContent).not.toContain("Enqueue");
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

	it("retains the last exact target snapshot and disables its interactions after removal", async () => {
		const { readControl } = await renderItemDetail();
		const owner = currentRuntime.items.find((item) => item.item.id === "workshop");
		if (owner === undefined) throw new Error("Missing Workshop runtime item.");

		await act(async () => {
			readControl().openItemDetail({
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
			).every((button) => button.disabled),
		).toBe(true);
		expect(
			document.querySelector<HTMLButtonElement>('[data-ui="TileLineStartButton"]')?.disabled,
		).toBe(true);
	});
});
