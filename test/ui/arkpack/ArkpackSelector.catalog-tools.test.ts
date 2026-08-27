// @vitest-environment jsdom

import { Effect, SubscriptionRef } from "effect";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ArkpackCatalog } from "~/bridge/arkpack/ArkpackCatalog";
import {
	buttonByText,
	cleanupArkpackSelectorTests,
	renderArkpackSelector,
} from "~test/ui/arkpack/ArkpackSelector.test/fixture";

const openEditorArkpack = vi.hoisted(() => vi.fn());

vi.mock("~/bridge/arkpack/editor/openEditorArkpackAtom", async () => {
	const { Effect } = await import("effect");
	const Atom = await import("effect/unstable/reactivity/Atom");
	return {
		openEditorArkpackAtom: Atom.fn((packageId: string) =>
			Effect.sync(() => openEditorArkpack(packageId)),
		),
	};
});

afterEach(async () => {
	await cleanupArkpackSelectorTests();
	vi.restoreAllMocks();
});

const createCatalog = ({
	refreshFx = Effect.void,
}: {
	readonly refreshFx?: ArkpackCatalog["refreshFx"];
} = {}): ArkpackCatalog => ({
	awaitIdleFx: Effect.void,
	state: Effect.runSync(
		SubscriptionRef.make<ArkpackCatalog.State>({
			type: "ready",
			arkpacks: [
				{
					packageId: "arkini",
					contentHash: "a".repeat(64),
					title: "Custom Arkini",
					version: "1.0",
					arkini: "1",
					trust: {
						type: "external",
					},
					source: "user",
					overridesBundled: true,
					filename: "arkini.arkpack",
				},
			],
		}),
	),
	refreshFx,
	importFileFx: () => Effect.die("Unexpected import."),
	installFx: () => Effect.die("Unexpected install."),
	removeFx: () => Effect.die("Unexpected removal."),
});

describe("ArkpackSelector catalog tools", () => {
	it("labels a user override and exposes folder and refresh operations", async () => {
		const refresh = vi.fn();
		const openUserDirectory = vi.fn(() => Promise.resolve());
		const { container } = await renderArkpackSelector({
			catalog: createCatalog({
				refreshFx: Effect.sync(refresh),
			}),
			openUserDirectory,
		});

		expect(container.textContent).toContain("External");
		expect(container.textContent).toContain("User override");
		expect(buttonByText(container, "Remove override")).toBeInstanceOf(HTMLButtonElement);

		await act(async () => {
			buttonByText(container, "Open Arkpack folder").click();
			await Promise.resolve();
			await Promise.resolve();
		});
		expect(openUserDirectory).toHaveBeenCalledOnce();

		await act(async () => {
			buttonByText(container, "Refresh").click();
			await Promise.resolve();
			await Promise.resolve();
		});
		expect(refresh).toHaveBeenCalledOnce();
	});

	it("blocks overlapping catalog actions until a manual refresh settles", async () => {
		let finishRefresh!: () => void;
		const refreshing = new Promise<void>((resolve) => {
			finishRefresh = resolve;
		});
		const openUserDirectory = vi.fn(() => Promise.resolve());
		const { container } = await renderArkpackSelector({
			catalog: createCatalog({
				refreshFx: Effect.promise(() => refreshing),
			}),
			openUserDirectory,
		});
		const refreshButton = buttonByText(container, "Refresh");
		const folderButton = buttonByText(container, "Open Arkpack folder");

		await act(async () => {
			refreshButton.click();
			await Promise.resolve();
		});
		expect(container.textContent).toContain("Refreshing packages…");
		expect(refreshButton.disabled).toBe(true);
		expect(folderButton.disabled).toBe(true);
		folderButton.click();
		expect(openUserDirectory).not.toHaveBeenCalled();

		await act(async () => {
			finishRefresh();
			await refreshing;
			await Promise.resolve();
			await Promise.resolve();
		});
		expect(refreshButton.disabled).toBe(false);
		expect(folderButton.disabled).toBe(false);
	});

	it("opens the exact catalog package in Editor", async () => {
		openEditorArkpack.mockReturnValue({
			projectId: "arkini",
		});
		const { container, router } = await renderArkpackSelector({
			catalog: createCatalog(),
		});

		await act(async () => {
			buttonByText(container, "Editor").click();
			await Promise.resolve();
			await Promise.resolve();
		});

		expect(openEditorArkpack).toHaveBeenCalledWith("arkini");
		expect(router.state.location.pathname).toBe("/editor/arkini/editor/items/list");
	});
});
