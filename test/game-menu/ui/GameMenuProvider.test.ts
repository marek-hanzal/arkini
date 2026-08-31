// @vitest-environment jsdom

import { act, createElement, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import type { GameMenuControl } from "~/game-menu/type/GameMenuControl";
import { GameMenuProvider } from "~/game-menu/ui/GameMenuProvider";
import { useGameMenuControl } from "~/game-menu/ui/GameMenuProvider";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

describe("GameMenuProvider", () => {
	it("serializes same-tick lifecycle and action claims under StrictMode", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		let menu: GameMenuControl | undefined;
		const Probe = () => {
			menu = useGameMenuControl();
			return null;
		};
		await act(async () => {
			root.render(
				createElement(
					StrictMode,
					null,
					createElement(GameMenuProvider, null, createElement(Probe)),
				),
			);
		});
		if (menu === undefined) throw new Error("Expected game menu control.");

		await act(async () => {
			menu?.open();
			expect(menu?.beginAction("save")).toBe(false);
			menu?.completeEnter();
			expect(menu?.beginAction("save")).toBe(true);
			expect(menu?.beginAction("settings")).toBe(false);
			menu?.close();
		});
		expect(menu.phase).toBe("open");
		expect(menu.activeAction).toBe("save");

		await act(async () => {
			menu?.completeAction("settings");
			expect(menu?.beginAction("settings")).toBe(false);
			menu?.completeAction("save");
			menu?.close();
		});
		expect(menu.phase).toBe("exiting");
		expect(menu.activeAction).toBeNull();
	});
});
