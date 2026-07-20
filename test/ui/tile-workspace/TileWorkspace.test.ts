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
			tags: [],
			categoryId: "resource",
			scope: "any",
			maxStackSize: 10,
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
							type: "simple",
						},
					],
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
	it("shows a large Arkpack visual and restores focus after Escape close", async () => {
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
		expect(modal.querySelector("h2")?.textContent).toBe("Stone · Resource");
		expect(modal.textContent).toContain("worth inspecting up close");
		expect(
			modal
				.querySelector<HTMLImageElement>('[data-ui="TileInfoArtwork"] img')
				?.getAttribute("src"),
		).toBe("resource:asset:stone");
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
		expect(modal.querySelector("h2")?.textContent).toBe("Workshop · Ready");
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
		expect(modal.querySelector("h2")?.textContent).toBe("Workshop · Working");
		expect(modal.textContent).toContain("currently running");

		await act(async () => {
			publishRuntime({
				...currentRuntime,
				items: currentRuntime.items.filter((item) => item.item.id !== "permit"),
			});
			await Promise.resolve();
		});
		expect(container.querySelector('[data-ui="TileWorkspaceModal"]')).toBe(modal);
		expect(modal.querySelector("h2")?.textContent).toBe("Workshop · Paused");
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
		expect(modal.querySelector("h2")?.textContent).toBe("Workshop · Paused");
		expect(modal.textContent).toContain("while this item is in the Toolbar");

		await act(async () => {
			publishRuntime({
				...currentRuntime,
				jobs: [],
			});
			await Promise.resolve();
		});
		expect(container.querySelector('[data-ui="TileWorkspaceModal"]')).toBe(modal);
		expect(modal.querySelector("h2")?.textContent).toBe("Workshop · Stored");
		expect(modal.textContent).toContain("Move it back to the Board");
	});
});
