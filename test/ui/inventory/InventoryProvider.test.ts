// @vitest-environment jsdom

import { act, createElement, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { GameMenuControl } from "~/ui/game-menu/GameMenuControl";
import { GameMenuProvider } from "~/ui/game-menu/GameMenuProvider";
import { useGameMenuControl } from "~/ui/game-menu/useGameMenuControl";
import type { InventoryControl } from "~/ui/inventory/InventoryControl";
import { InventoryHigherOwnerGuard } from "~/ui/inventory/InventoryHigherOwnerGuard";
import { InventoryHost } from "~/ui/inventory/InventoryHost";
import { InventoryProvider } from "~/ui/inventory/InventoryProvider";
import { useInventoryControl } from "~/ui/inventory/useInventoryControl";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("~/ui/inventory/Inventory", () => ({
	Inventory: "inventory-surface",
}));
const roots: Array<ReturnType<typeof createRoot>> = [];

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

const ControlProbe = ({
	onControl,
}: {
	readonly onControl: (control: InventoryControl) => void;
}) => {
	const control = useInventoryControl();
	useEffect(
		() => onControl(control),
		[
			control,
			onControl,
		],
	);
	return createElement(
		"div",
		null,
		createElement(
			"button",
			{
				"data-ui": "BoardControl",
				type: "button",
			},
			"Board control",
		),
		createElement(
			"button",
			{
				"data-ui": "OtherControl",
				type: "button",
			},
			"Other control",
		),
	);
};

const GameMenuProbe = ({
	onControl,
}: {
	readonly onControl: (control: GameMenuControl) => void;
}) => {
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

const renderShell = async () => {
	let control: InventoryControl | undefined;
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
					InventoryProvider,
					null,
					createElement(InventoryHigherOwnerGuard),
					createElement(GameMenuProbe, {
						onControl: (next) => {
							gameMenu = next;
						},
					}),
					createElement(
						"div",
						{
							"data-ui": "TileScene",
						},
						createElement(ControlProbe, {
							onControl: (next) => {
								control = next;
							},
						}),
						createElement(InventoryHost),
						createElement("tile-actor-layer"),
					),
				),
			),
		);
	});
	return {
		container,
		readControl: () => {
			if (control === undefined) throw new Error("Missing Inventory control.");
			return control;
		},
		readGameMenu: () => {
			if (gameMenu === undefined) throw new Error("Missing Game Menu control.");
			return gameMenu;
		},
	};
};

describe("InventoryProvider", () => {
	it("mounts and unregisters one non-modal surface inside the existing Tile scene", async () => {
		const { container, readControl } = await renderShell();
		const origin = container.querySelector<HTMLButtonElement>('[data-ui="BoardControl"]');
		const other = container.querySelector<HTMLButtonElement>('[data-ui="OtherControl"]');
		if (origin === null) throw new Error("Missing Board control origin.");
		if (other === null) throw new Error("Missing secondary control.");
		origin.focus();

		expect(readControl().state).toEqual({
			phase: "closed",
		});
		expect(readControl().close()).toBe(false);
		expect(container.querySelector('[data-ui="InventoryHost"]')).toBeNull();
		expect(container.querySelectorAll("tile-actor-layer")).toHaveLength(1);

		await act(async () => {
			expect(
				readControl().open({
					origin,
				}),
			).toBe(true);
		});

		const tileScene = container.querySelector('[data-ui="TileScene"]');
		const host = container.querySelector('[data-ui="InventoryHost"]');
		expect(host?.parentElement).toBe(tileScene);
		expect(host?.className).toContain("pointer-events-none");
		expect(origin.closest("[inert]")).toBeNull();
		expect(container.querySelectorAll("inventory-surface")).toHaveLength(1);
		expect(container.querySelectorAll("tile-actor-layer")).toHaveLength(1);
		other.focus();
		expect(document.activeElement).toBe(other);

		await act(async () => {
			expect(
				readControl().open({
					origin: null,
				}),
			).toBe(false);
		});
		expect(container.querySelectorAll('[data-ui="InventoryHost"]')).toHaveLength(1);
		const openState = readControl().state;
		expect(openState.phase).toBe("open");
		if (openState.phase !== "open") throw new Error("Expected open Inventory state.");
		expect(openState.origin).toBe(origin);

		act(() => {
			other.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "Escape",
					bubbles: true,
					cancelable: true,
				}),
			);
		});

		expect(readControl().state).toEqual({
			phase: "closed",
		});
		expect(container.querySelector('[data-ui="InventoryHost"]')).toBeNull();
		expect(container.querySelector("inventory-surface")).toBeNull();
		expect(container.querySelectorAll("tile-actor-layer")).toHaveLength(1);
		expect(document.activeElement).toBe(origin);
	});

	it("restores focus only to a connected focusable origin", async () => {
		const { container, readControl } = await renderShell();
		const disconnectedOrigin = document.createElement("button");
		const unfocusableOrigin = document.createElement("div");
		document.body.append(unfocusableOrigin);
		const fallback = container.querySelector<HTMLButtonElement>('[data-ui="OtherControl"]');
		if (fallback === null) throw new Error("Missing secondary control.");

		await act(async () => {
			expect(
				readControl().open({
					origin: disconnectedOrigin,
				}),
			).toBe(true);
		});
		fallback.focus();
		expect(document.activeElement).toBe(fallback);

		await act(async () => {
			expect(readControl().close()).toBe(true);
		});

		expect(document.activeElement).not.toBe(disconnectedOrigin);
		expect(document.activeElement).toBe(fallback);

		await act(async () => {
			expect(
				readControl().open({
					origin: unfocusableOrigin,
				}),
			).toBe(true);
		});
		fallback.focus();
		await act(async () => {
			expect(readControl().close()).toBe(true);
		});
		expect(document.activeElement).toBe(fallback);
		expect(readControl().close()).toBe(false);
	});

	it("yields ownership to Game Menu without restoring focus under the modal", async () => {
		const { container, readControl, readGameMenu } = await renderShell();
		const origin = container.querySelector<HTMLButtonElement>('[data-ui="BoardControl"]');
		const fallback = container.querySelector<HTMLButtonElement>('[data-ui="OtherControl"]');
		if (origin === null) throw new Error("Missing Board control origin.");
		if (fallback === null) throw new Error("Missing secondary control.");

		origin.focus();
		await act(async () => {
			readControl().open({
				origin,
			});
		});
		fallback.focus();

		await act(async () => readGameMenu().open());

		expect(readGameMenu().phase).toBe("entering");
		expect(readControl().state).toEqual({
			phase: "closed",
		});
		expect(container.querySelector('[data-ui="InventoryHost"]')).toBeNull();
		expect(document.activeElement).toBe(fallback);
	});
});
