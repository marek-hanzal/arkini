// @vitest-environment jsdom

import { RegistryContext, scheduleTask } from "@effect/atom-react";
import { Effect } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CheatAvailabilityAtom } from "~/bridge/cheat/CheatAvailabilityAtom";
import type { Game } from "~/bridge/game/Game";
import { CheatItemSpotlight } from "~/ui/cheat-spotlight/CheatItemSpotlight";
import { CheatItemSpawnProvider } from "~/ui/cheat-spotlight/CheatItemSpawnProvider";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const state = vi.hoisted(() => ({
	complete: undefined as (() => void) | undefined,
	interrupted: vi.fn(),
	mode: "success" as "pending" | "success",
	run: vi.fn(),
	spawn: vi.fn(),
}));

vi.mock("~/bridge/cheat/useGameCheats", () => ({
	useGameCheats: () => ({
		enabled: true,
		everEnabled: true,
		instantGameplay: false,
	}),
}));
vi.mock("~/bridge/cheat/useCheatItemCatalog", () => ({
	useCheatItemCatalog: () => [
		{
			itemId: "item:alpha",
			title: "Alpha",
			sourceResourceId: "alpha",
			sourceUrl: "blob:alpha",
		},
		{
			itemId: "item:beta",
			title: "Beta",
			sourceResourceId: "beta",
			sourceUrl: "blob:beta",
		},
	],
}));
vi.mock("~/engine/cheat/write/spawnCheatItemFx", async () => {
	const { Effect } = await import("effect");
	return {
		spawnCheatItemFx: ({ itemId }: { readonly itemId: string }) => {
			state.spawn(itemId);
			return Effect.void;
		},
	};
});
vi.mock("~/ui/game-menu/useGameMenuControl", () => ({
	useGameMenuControl: () => ({
		isOpen: false,
	}),
}));
vi.mock("~/ui/item-detail/useItemDetailControl", () => ({
	useItemDetailControl: () => ({
		isOpen: false,
	}),
}));

const roots: Array<ReturnType<typeof createRoot>> = [];
const registries: AtomRegistry.AtomRegistry[] = [];
let registry: AtomRegistry.AtomRegistry;

const makeRegistry = () => {
	const next = AtomRegistry.make({
		scheduleTask,
	});
	registries.push(next);
	return next;
};

const createGame = (): Game =>
	({
		runFx: ((effect: Effect.Effect<unknown, unknown>) => {
			state.run(effect);
			if (state.mode === "success") return effect;
			return Effect.callback<void>((resume) => {
				state.complete = () => {
					state.complete = undefined;
					state.mode = "success";
					resume(Effect.void);
				};
				return Effect.sync(state.interrupted);
			}).pipe(Effect.andThen(effect));
		}) as Game["runFx"],
	}) as Game;

const SpotlightUnderTest = ({
	alwaysAvailable,
	game,
	onBeforeOpen,
}: {
	readonly alwaysAvailable?: boolean;
	readonly game: Game;
	readonly onBeforeOpen?: () => void;
}) =>
	createElement(
		RegistryContext.Provider,
		{
			value: registry,
		},
		createElement(
			CheatItemSpawnProvider,
			{
				game,
			},
			createElement(CheatItemSpotlight, {
				alwaysAvailable,
				game,
				onBeforeOpen,
			}),
		),
	);

beforeEach(() => {
	registry = makeRegistry();
	registry.set(CheatAvailabilityAtom, true);
	state.complete = undefined;
	state.interrupted.mockReset();
	state.mode = "success";
	state.run.mockReset();
	state.spawn.mockReset();
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	for (const current of registries.splice(0)) current.dispose();
	document.body.replaceChildren();
});

describe("CheatItemSpotlight", () => {
	it("allows an editor-owned override of the global player preference", async () => {
		registry.set(CheatAvailabilityAtom, false);
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => {
			root.render(
				createElement(SpotlightUnderTest, {
					alwaysAvailable: true,
					game: createGame(),
				}),
			);
		});
		await act(async () => {
			document.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "p",
					code: "KeyP",
					ctrlKey: true,
					bubbles: true,
					cancelable: true,
				}),
			);
			await Promise.resolve();
		});
		expect(container.querySelector('[data-ui="CheatItemSpotlight"]')).not.toBeNull();
	});

	it("opens through TanStack Mod+P and spawns the keyboard-selected catalog item", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		const onBeforeOpen = vi.fn(() => {
			expect(container.querySelector('[data-ui="CheatItemSpotlight"]')).toBeNull();
		});
		await act(async () => {
			root.render(
				createElement(SpotlightUnderTest, {
					game: createGame(),
					onBeforeOpen,
				}),
			);
		});
		await act(async () => {
			document.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "p",
					code: "KeyP",
					ctrlKey: true,
					bubbles: true,
					cancelable: true,
				}),
			);
			await Promise.resolve();
		});
		expect(onBeforeOpen).toHaveBeenCalledOnce();
		const input = container.querySelector<HTMLInputElement>('input[type="search"]');
		if (input === null) throw new Error("Expected Spotlight search input.");
		await act(async () => {
			input.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "ArrowDown",
					bubbles: true,
					cancelable: true,
				}),
			);
		});
		await vi.waitFor(() =>
			expect(
				container.querySelector<HTMLButtonElement>('button[data-selected="true"]')
					?.textContent,
			).toContain("Beta"),
		);
		await act(async () => {
			input.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "Enter",
					bubbles: true,
					cancelable: true,
				}),
			);
		});
		expect(state.spawn).toHaveBeenCalledWith("item:beta");

		const selectedOption = container.querySelector<HTMLButtonElement>(
			'button[data-selected="true"]',
		);
		await act(async () => {
			selectedOption?.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "Escape",
					bubbles: true,
					cancelable: true,
				}),
			);
		});
		expect(container.querySelector('[data-ui="CheatItemSpotlight"]')).toBeNull();
	});
	it("admits every same-tick keyboard and pointer spawn action", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => {
			root.render(
				createElement(SpotlightUnderTest, {
					game: createGame(),
				}),
			);
		});
		await act(async () => {
			document.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "p",
					code: "KeyP",
					ctrlKey: true,
					bubbles: true,
					cancelable: true,
				}),
			);
			await Promise.resolve();
		});
		const input = container.querySelector<HTMLInputElement>('input[type="search"]');
		const selected = container.querySelector<HTMLButtonElement>(
			'[data-ui="CheatItemSpotlightResults"] button[data-selected="true"]',
		);
		if (input === null || selected === null) throw new Error("Expected Spotlight controls.");

		await act(async () => {
			input.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "Enter",
					bubbles: true,
					cancelable: true,
				}),
			);
			selected.click();
		});

		expect(state.spawn).toHaveBeenCalledTimes(2);
	});
	it("retains command ownership while pending without locking spotlight interaction", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => {
			root.render(
				createElement(SpotlightUnderTest, {
					game: createGame(),
				}),
			);
		});
		const toggle = async () => {
			await act(async () => {
				document.dispatchEvent(
					new KeyboardEvent("keydown", {
						key: "p",
						code: "KeyP",
						ctrlKey: true,
						bubbles: true,
						cancelable: true,
					}),
				);
				await Promise.resolve();
			});
		};

		await toggle();
		state.mode = "pending";
		const spawnInput = container.querySelector<HTMLInputElement>('input[type="search"]');
		if (spawnInput === null) throw new Error("Expected Spotlight search input.");
		await act(async () => {
			spawnInput.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "Enter",
					bubbles: true,
					cancelable: true,
				}),
			);
		});
		const pendingInput = container.querySelector<HTMLInputElement>('input[type="search"]');
		if (pendingInput === null) throw new Error("Expected pending Spotlight search input.");
		expect(pendingInput.readOnly).toBe(false);
		expect(container.textContent).toContain("Spawning…");

		await toggle();
		expect(container.querySelector('[data-ui="CheatItemSpotlight"]')).toBeNull();

		await toggle();
		const reopenedInput = container.querySelector<HTMLInputElement>('input[type="search"]');
		if (reopenedInput === null) throw new Error("Expected reopened Spotlight search input.");
		expect(reopenedInput.readOnly).toBe(false);

		const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
		if (setter === undefined) throw new Error("Expected native input setter.");
		await act(async () => {
			setter.call(reopenedInput, "beta");
			reopenedInput.dispatchEvent(
				new Event("input", {
					bubbles: true,
				}),
			);
		});
		expect(reopenedInput.value).toBe("beta");
		expect(
			Array.from(container.querySelectorAll<HTMLButtonElement>("button")).every(
				(button) => button.disabled,
			),
		).toBe(false);

		await toggle();
		const complete = state.complete;
		if (complete === undefined) throw new Error("Expected pending spawn completion.");
		await act(async () => {
			complete();
			await Promise.resolve();
		});
		await toggle();
		expect(container.querySelector<HTMLInputElement>('input[type="search"]')?.readOnly).toBe(
			false,
		);
		expect(container.textContent).toContain("Enter spawn");

		await toggle();
		await toggle();
		expect(container.textContent).toContain("Enter spawn");
	});
	it("retains spawn admission while the Board-local Spotlight unmounts and remounts", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		const game = createGame();
		const renderTree = (showSpotlight: boolean) =>
			createElement(
				RegistryContext.Provider,
				{
					value: registry,
				},
				createElement(
					CheatItemSpawnProvider,
					{
						game,
					},
					showSpotlight
						? createElement(CheatItemSpotlight, {
								game,
							})
						: null,
				),
			);
		await act(async () => root.render(renderTree(true)));
		const toggle = async () => {
			await act(async () => {
				document.dispatchEvent(
					new KeyboardEvent("keydown", {
						key: "p",
						code: "KeyP",
						ctrlKey: true,
						bubbles: true,
						cancelable: true,
					}),
				);
				await Promise.resolve();
			});
		};

		await toggle();
		state.mode = "pending";
		const input = container.querySelector<HTMLInputElement>('input[type="search"]');
		if (input === null) throw new Error("Expected Spotlight input.");
		await act(async () => {
			input.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "Enter",
					bubbles: true,
					cancelable: true,
				}),
			);
		});
		expect(state.spawn).toHaveBeenCalledOnce();

		await act(async () => root.render(renderTree(false)));
		await act(async () => root.render(renderTree(true)));
		await toggle();
		const remounted = container.querySelector<HTMLInputElement>('input[type="search"]');
		if (remounted === null) throw new Error("Expected remounted Spotlight input.");
		expect(remounted.readOnly).toBe(false);
		await act(async () => {
			remounted.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "Enter",
					bubbles: true,
					cancelable: true,
				}),
			);
		});
		expect(state.spawn).toHaveBeenCalledTimes(2);
	});
	it("searches the authoritative catalog by shared Fuse terms", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => {
			root.render(
				createElement(SpotlightUnderTest, {
					game: createGame(),
				}),
			);
		});
		await act(async () => {
			document.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "p",
					code: "KeyP",
					ctrlKey: true,
					bubbles: true,
					cancelable: true,
				}),
			);
			await Promise.resolve();
		});
		const input = container.querySelector<HTMLInputElement>('input[type="search"]');
		if (input === null) throw new Error("Expected Spotlight search input.");
		const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
		if (setter === undefined) throw new Error("Expected native input setter.");
		await act(async () => {
			setter.call(input, "item:beta");
			input.dispatchEvent(
				new Event("input", {
					bubbles: true,
				}),
			);
		});

		const options = Array.from(
			container.querySelectorAll<HTMLButtonElement>(
				'[data-ui="CheatItemSpotlightResults"] button',
			),
		);
		expect(options).toHaveLength(1);
		expect(options[0]?.textContent).toContain("Beta");
	});
});
