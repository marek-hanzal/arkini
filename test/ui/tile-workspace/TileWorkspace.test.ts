// @vitest-environment jsdom

import { Effect } from "effect";
import { act, createElement, useContext, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Game } from "~/bridge/game/Game";
import { useGameFx } from "~/engine/game/fx/useGameFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { startFx } from "~/engine/start/write/startFx";
import { TileWorkspace } from "~/ui/tile-workspace/TileWorkspace";
import { TileWorkspaceContext } from "~/ui/tile-workspace/TileWorkspaceContext";
import type { TileWorkspaceControl } from "~/ui/tile-workspace/TileWorkspaceControl";
import { TileWorkspaceProvider } from "~/ui/tile-workspace/TileWorkspaceProvider";
import { motionTestRuntime } from "~test/ui/support/motionReactMock";

vi.mock("motion/react", async () => import("~test/ui/support/motionReactMock"));

const gameEngineState = vi.hoisted(() => ({
	game: undefined as Game | undefined,
}));

vi.mock("~/bridge/game/useGameEngine", () => ({
	useGameEngine: () => {
		const current = gameEngineState.game;
		if (current === undefined) throw new Error("Test Game Engine is missing.");
		return current;
	},
}));

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const config = GameConfigSchema.parse({
	version: "1.0",
	resources: {
		hero: "hero",
		tileCapabilities: {
			info: "tile-capability-info",
			status: "tile-capability-status",
			lines: "tile-capability-lines",
			effects: "tile-capability-effects",
		},
	},
	meta: {
		id: "game:tile-info",
		title: "Tile info",
		board: {
			width: 2,
			height: 1,
		},
		inventory: {
			width: 2,
			height: 1,
		},
		toolbarSize: 1,
	},
	start: {
		currentSpace: 0,
		board: [
			{
				itemId: "stone",
				space: 0,
				x: 0,
				y: 0,
			},
			{
				itemId: "workshop",
				space: 0,
				x: 1,
				y: 0,
			},
		],
		inventory: [
			{
				itemId: "permit",
			},
		],
	},
	categories: {
		resource: {
			id: "resource",
			title: "Resource",
		},
		building: {
			id: "building",
			title: "Building",
		},
	},
	items: {
		stone: {
			id: "stone",
			type: "simple",
			title: "Stone",
			description: "A sturdy piece of stone worth inspecting up close.",
			asset: {
				source: [
					"asset:stone",
				],
			},
			tags: [
				"material",
				"era:I",
			],
			categoryId: "resource",
			scope: "any",
			maxCount: 12,
			maxStackSize: 10,
			charges: {
				amount: 3,
			},
		},
		permit: {
			id: "permit",
			type: "simple",
			title: "Permit",
			description: "Keeps the workshop enabled.",
			asset: {
				source: [
					"asset:permit",
				],
			},
			tags: [],
			categoryId: "resource",
			scope: "any",
			maxStackSize: 1,
		},
		workshop: {
			id: "workshop",
			type: "producer",
			title: "Workshop",
			description: "Runs one inspected production line.",
			asset: {
				source: [
					"asset:workshop",
				],
			},
			tags: [],
			categoryId: "building",
			scope: "any",
			maxStackSize: 1,
			maxQueueSize: 1,
			lines: [
				{
					id: "line:workshop:run",
					title: "Run",
					description: "Runs the workshop.",
					show: true,
					enable: false,
					runtimeMs: 1_000,
					input: [
						{
							type: "materials",
							selector: {
								type: "item",
								itemId: "stone",
							},
							quantity: {
								type: "value",
								value: 2,
							},
							capacity: 1,
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
												itemId: "stone",
												quantity: {
													type: "value",
													value: 1,
												},
												rules: [],
											},
										],
									},
									{
										type: "chance",
										chance: 0.5,
										drop: [
											{
												itemId: "permit",
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
					rules: [
						{
							type: "enable",
							when: [
								{
									type: "exists",
									query: {
										scope: "any",
										selector: {
											type: "item",
											itemId: "permit",
										},
									},
								},
							],
						},
					],
				},
			],
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
const listeners = new Set<() => void>();
const publishRuntime = (runtime: typeof initialRuntime) => {
	currentRuntime = runtime;
	for (const listener of listeners) listener();
};

const game = {
	arkpack: {
		packageId: "package:tile-info",
		contentHash: "content:tile-info",
		gameId: config.meta.id,
		title: config.meta.title,
		configVersion: config.version,
		compressedSize: 0,
		source: "imported" as const,
	},
	config,
	saveKey: {
		packageId: "package:tile-info",
		contentHash: "a".repeat(64),
	},
	getSnapshot: () => currentRuntime,
	getResourceUrl: (resourceId: string) => `resource:${resourceId}`,
	subscribe: (listener: () => void) => {
		listeners.add(listener);
		return () => listeners.delete(listener);
	},
	subscribeEvents: () => () => undefined,
	run: (() => Promise.reject(new Error("Not used by this test."))) as Game["run"],
	disposeFx: Effect.void,
	disposeWithoutSaveFx: Effect.void,
	flushSaveFx: Effect.void,
} satisfies Game;

const roots: Array<ReturnType<typeof createRoot>> = [];

const Capture = ({
	onControl,
}: {
	readonly onControl: (control: TileWorkspaceControl) => void;
}) => {
	const control = useContext(TileWorkspaceContext);
	if (control === undefined) throw new Error("Missing TileWorkspaceProvider.");
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
	motionTestRuntime.autoComplete = false;
	currentRuntime = initialRuntime;
	listeners.clear();
	gameEngineState.game = game;
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	vi.restoreAllMocks();
	document.body.replaceChildren();
	gameEngineState.game = undefined;
});

const renderWorkspace = async () => {
	let control: TileWorkspaceControl | null = null;
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => {
		root.render(
			createElement(
				TileWorkspaceProvider,
				null,
				createElement(Capture, {
					onControl: (next) => {
						control = next;
					},
				}),
				createElement(TileWorkspace),
			),
		);
	});
	const readControl = () => {
		if (control === null) throw new Error("Workspace control was not captured.");
		return control;
	};
	return {
		container,
		readControl,
	};
};

const finishLatestMotion = async () => {
	await act(async () => {
		motionTestRuntime.finish(motionTestRuntime.completions.length - 1);
		await Promise.resolve();
	});
};

describe("TileWorkspace Info", () => {
	it("shows the compact shared header and structured common item facts", async () => {
		const { container, readControl } = await renderWorkspace();
		const origin = document.createElement("button");
		origin.type = "button";
		origin.textContent = "Origin tile";
		document.body.append(origin);
		origin.focus();
		const runtimeId = currentRuntime.items[0]?.id;
		if (runtimeId === undefined) throw new Error("Missing runtime item.");

		await act(async () => {
			expect(readControl().openInfo(runtimeId, origin)).toBe(true);
		});
		const modal = container.querySelector<HTMLElement>('[data-ui="TileWorkspaceModal"]');
		if (modal === null) throw new Error("Missing tile workspace modal.");
		expect(modal.dataset.runtimeId).toBe(runtimeId);
		expect(modal.querySelector("h2")?.textContent).toBe("Stone");
		expect(modal.textContent).toContain("Resource");
		expect(modal.textContent).toContain("worth inspecting up close");
		const headerArtwork = modal.querySelector<HTMLElement>(
			'[data-ui="TileWorkspaceHeaderArtwork"]',
		);
		expect(headerArtwork?.classList.contains("size-16")).toBe(true);
		expect(headerArtwork?.querySelector("img")?.getAttribute("src")).toBe(
			"resource:asset:stone",
		);
		const facts = Object.fromEntries(
			Array.from(modal.querySelectorAll<HTMLElement>('[data-ui="TileInfoFact"]')).map(
				(fact) => [
					fact.dataset.label,
					fact.querySelector("dd")?.textContent,
				],
			),
		);
		expect(facts).toMatchObject({
			Category: "Resource",
			Type: "Simple item",
			Location: "Board · Space 1",
			Storage: "Board, Inventory & Toolbar",
			"Current stack": "1 item",
			"Stack capacity": "10 items",
			Owned: "1 / 12",
			"Game limit": "12",
			Charges: "3 / 3",
		});
		expect(
			Array.from(modal.querySelectorAll<HTMLElement>('[data-ui="TileInfoTraits"] span')).map(
				(trait) => trait.textContent,
			),
		).toEqual([
			"Material",
			"Era I",
		]);
		expect(modal.className).toContain("max-w-5xl");

		await finishLatestMotion();
		expect(document.activeElement?.getAttribute("aria-label")).toBe("Close Info");
		await act(async () => {
			window.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "Escape",
					bubbles: true,
					cancelable: true,
				}),
			);
		});
		expect(container.querySelector('[data-phase="exiting"]')).not.toBeNull();
		await finishLatestMotion();
		expect(container.querySelector('[data-ui="TileWorkspaceModal"]')).toBeNull();
		expect(document.activeElement).toBe(origin);
	});

	it("closes instead of retargeting when the exact runtime item disappears", async () => {
		const { container, readControl } = await renderWorkspace();
		const runtimeId = currentRuntime.items[0]?.id;
		if (runtimeId === undefined) throw new Error("Missing runtime item.");
		await act(async () => {
			readControl().openInfo(runtimeId, null);
		});
		await finishLatestMotion();

		await act(async () => {
			publishRuntime({
				...currentRuntime,
				items: [],
			});
			await Promise.resolve();
		});
		expect(container.querySelector('[data-phase="exiting"]')).not.toBeNull();
		await finishLatestMotion();
		expect(container.querySelector('[data-ui="TileWorkspaceModal"]')).toBeNull();
	});
});

describe("TileWorkspace Status", () => {
	it("updates one open modal across ready, working, dependency-paused, and stored states", async () => {
		const { container, readControl } = await renderWorkspace();
		const workshop = currentRuntime.items.find((item) => item.item.id === "workshop");
		if (workshop === undefined) throw new Error("Missing workshop runtime item.");

		await act(async () => {
			expect(readControl().openStatus(workshop.id, null)).toBe(true);
		});
		const modal = container.querySelector<HTMLElement>('[data-ui="TileWorkspaceModal"]');
		if (modal === null) throw new Error("Missing Status workspace modal.");
		expect(modal.dataset.capability).toBe("status");
		expect(modal.querySelector("h2")?.textContent).toBe("Workshop");
		expect(
			modal
				.querySelector<HTMLImageElement>('[data-ui="TileWorkspaceHeaderArtwork"] img')
				?.getAttribute("src"),
		).toBe("resource:asset:workshop");
		expect(modal.textContent).toContain("Building · Ready");
		expect(modal.textContent).toContain("available for work");
		await finishLatestMotion();

		await act(async () => {
			publishRuntime({
				...currentRuntime,
				jobs: [
					{
						id: "job:workshop",
						ownerItemId: workshop.id,
						lineId: "line:workshop:run",
						durationMs: 1_000,
						remainingMs: 500,
					},
				],
			});
			await Promise.resolve();
		});
		expect(container.querySelector('[data-ui="TileWorkspaceModal"]')).toBe(modal);
		expect(modal.querySelector("h2")?.textContent).toBe("Workshop");
		expect(modal.textContent).toContain("Building · Working");
		expect(modal.textContent).toContain("currently running");

		await act(async () => {
			publishRuntime({
				...currentRuntime,
				items: currentRuntime.items.filter((item) => item.item.id !== "permit"),
			});
			await Promise.resolve();
		});
		expect(container.querySelector('[data-ui="TileWorkspaceModal"]')).toBe(modal);
		expect(modal.querySelector("h2")?.textContent).toBe("Workshop");
		expect(modal.textContent).toContain("Building · Paused");
		expect(modal.textContent).toContain("dependencies are no longer satisfied");

		await act(async () => {
			publishRuntime({
				...currentRuntime,
				items: currentRuntime.items.map((item) =>
					item.id === workshop.id
						? {
								...item,
								revision: "revision:workshop:toolbar",
								location: {
									scope: "toolbar" as const,
									position: {
										x: 0,
										y: 0,
									},
								},
							}
						: item,
				),
			});
			await Promise.resolve();
		});
		expect(container.querySelector('[data-ui="TileWorkspaceModal"]')).toBe(modal);
		expect(modal.querySelector("h2")?.textContent).toBe("Workshop");
		expect(modal.textContent).toContain("Building · Paused");
		expect(modal.textContent).toContain("while this item is in the Toolbar");

		await act(async () => {
			publishRuntime({
				...currentRuntime,
				jobs: [],
			});
			await Promise.resolve();
		});
		expect(container.querySelector('[data-ui="TileWorkspaceModal"]')).toBe(modal);
		expect(modal.querySelector("h2")?.textContent).toBe("Workshop");
		expect(modal.textContent).toContain("Building · Stored");
		expect(modal.textContent).toContain("Move it back to the Board");
	});
});

describe("TileWorkspace Lines", () => {
	it("renders live line readiness, inputs, outputs, runtime, and active work", async () => {
		const { container, readControl } = await renderWorkspace();
		const workshop = currentRuntime.items.find((item) => item.item.id === "workshop");
		if (workshop === undefined) throw new Error("Missing workshop runtime item.");

		await act(async () => {
			expect(readControl().openLines(workshop.id, null)).toBe(true);
		});
		const modal = container.querySelector<HTMLElement>('[data-ui="TileWorkspaceModal"]');
		if (modal === null) throw new Error("Missing Lines workspace modal.");
		expect(modal.dataset.capability).toBe("lines");
		expect(modal.querySelector("h2")?.textContent).toBe("Workshop");
		expect(modal.textContent).toContain("1 visible line");
		expect(modal.textContent).toContain("Run");
		expect(modal.textContent).toContain("Missing inputs");
		expect(modal.textContent).toContain("0 / 2 stored");
		expect(modal.textContent).toContain("2 still needed");
		expect(modal.textContent).toContain("Guaranteed");
		expect(modal.textContent).toContain("Stone");
		expect(modal.textContent).toContain("50% chance");
		expect(modal.textContent).toContain("Permit");
		expect(modal.textContent).toContain("1 s");
		await finishLatestMotion();

		await act(async () => {
			publishRuntime({
				...currentRuntime,
				items: [
					...currentRuntime.items,
					{
						id: "runtime:stone:input",
						item: config.items.stone,
						location: {
							scope: "input" as const,
							ownerItemId: workshop.id,
							lineId: "line:workshop:run",
							inputIndex: 0,
						},
						quantity: 2,
						revision: "revision:stone:input",
					},
				],
			});
			await Promise.resolve();
		});
		expect(container.querySelector('[data-ui="TileWorkspaceModal"]')).toBe(modal);
		expect(modal.textContent).toContain("Ready");
		expect(modal.textContent).toContain("2 / 2 stored");
		expect(modal.textContent).toContain("1 buffer space");

		await act(async () => {
			publishRuntime({
				...currentRuntime,
				jobs: [
					{
						id: "job:workshop:run",
						ownerItemId: workshop.id,
						lineId: "line:workshop:run",
						durationMs: 1_000,
						remainingMs: 500,
					},
				],
			});
			await Promise.resolve();
		});
		expect(container.querySelector('[data-ui="TileWorkspaceModal"]')).toBe(modal);
		expect(modal.textContent).toContain("Active");
		expect(modal.textContent).toContain("Current work");
		expect(modal.textContent).toContain("0.5 s remaining of 1 s");
	});
});

describe("TileWorkspace Effects", () => {
	it("renders incoming and outgoing effect conditions and updates them live", async () => {
		const { container, readControl } = await renderWorkspace();
		const workshop = currentRuntime.items.find((item) => item.item.id === "workshop");
		const permit = currentRuntime.items.find((item) => item.item.id === "permit");
		if (workshop === undefined || permit === undefined) {
			throw new Error("Missing workshop or permit runtime item.");
		}

		await act(async () => {
			expect(readControl().openEffects(workshop.id, null)).toBe(true);
		});
		const modal = container.querySelector<HTMLElement>('[data-ui="TileWorkspaceModal"]');
		if (modal === null) throw new Error("Missing Effects workspace modal.");
		expect(modal.dataset.capability).toBe("effects");
		expect(modal.querySelector("h2")?.textContent).toBe("Workshop");
		expect(modal.textContent).toContain("Incoming");
		expect(modal.textContent).toContain("Outgoing");
		expect(modal.textContent).toContain("Run reacts to permit");
		expect(modal.textContent).toContain("Enable line");
		expect(modal.textContent).toContain("Active");
		expect(modal.textContent).toContain("Permit");
		await finishLatestMotion();

		await act(async () => {
			publishRuntime({
				...currentRuntime,
				items: currentRuntime.items.filter((item) => item.item.id !== "permit"),
			});
			await Promise.resolve();
		});
		expect(modal.textContent).toContain("Inactive");
		expect(modal.textContent).toContain("No matching live items satisfy this condition.");

		await act(async () => {
			void readControl().close();
		});
		await finishLatestMotion();

		await act(async () => {
			publishRuntime(initialRuntime);
			await Promise.resolve();
		});
		const livePermit = currentRuntime.items.find((item) => item.item.id === "permit");
		if (livePermit === undefined) throw new Error("Missing restored permit runtime item.");

		await act(async () => {
			expect(readControl().openEffects(livePermit.id, null)).toBe(true);
		});
		const outgoingModal = container.querySelector<HTMLElement>(
			'[data-ui="TileWorkspaceModal"]',
		);
		if (outgoingModal === null) throw new Error("Missing outgoing Effects workspace modal.");
		expect(outgoingModal.textContent).toContain("Live conditions on other tiles");
		expect(outgoingModal.textContent).toContain("Workshop · Run");
		expect(outgoingModal.textContent).toContain(
			"This tile currently participates in another tile's line condition.",
		);
	});
});
