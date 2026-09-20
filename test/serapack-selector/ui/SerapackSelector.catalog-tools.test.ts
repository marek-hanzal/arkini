// @vitest-environment jsdom

import { Effect, SubscriptionRef } from "effect";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SerapackCatalog } from "~/serapack-catalog/service/SerapackCatalog";
import {
	buttonByText,
	cleanupSerapackSelectorTests,
	renderSerapackSelector,
} from "~test/serapack-selector/ui/SerapackSelector.test/fixture";

const openEditorSerapack = vi.hoisted(() => vi.fn());

vi.mock("~/project-authoring/atom/openEditorSerapackAtom", async () => {
	const { Effect } = await import("effect");
	const Atom = await import("effect/unstable/reactivity/Atom");
	return {
		openEditorSerapackAtom: Atom.fn((packageId: string) =>
			Effect.sync(() => openEditorSerapack(packageId)),
		),
	};
});

afterEach(async () => {
	await cleanupSerapackSelectorTests();
	vi.restoreAllMocks();
});

const createCatalog = ({
	refreshFx = Effect.void,
}: {
	readonly refreshFx?: SerapackCatalog["refreshFx"];
} = {}): SerapackCatalog => ({
	awaitIdleFx: Effect.void,
	state: Effect.runSync(
		SubscriptionRef.make<SerapackCatalog.State>({
			type: "ready",
			serapacks: [
				{
					packageId: "serakki",
					contentHash: "a".repeat(64),
					title: "Custom Serakki",
					version: "1.0",
					serakki: "1",
					provenance: {
						type: "community",
					},
					source: "user",
					overridesBundled: true,
					filename: "serakki.serapack",
				},
			],
		}),
	),
	refreshFx,
	importFileFx: () => Effect.die("Unexpected import."),
	installFx: () => Effect.die("Unexpected install."),
	removeFx: () => Effect.die("Unexpected removal."),
});

describe("SerapackSelector catalog tools", () => {
	it("labels a user override and exposes folder and refresh operations", async () => {
		const refresh = vi.fn();
		const openUserDirectory = vi.fn(() => Promise.resolve());
		const { container } = await renderSerapackSelector({
			catalog: createCatalog({
				refreshFx: Effect.sync(refresh),
			}),
			openUserDirectory,
		});

		expect(container.textContent).toContain("Community");
		expect(container.textContent).toContain("User override");
		expect(buttonByText(container, "Remove")).toBeInstanceOf(HTMLButtonElement);

		await act(async () => {
			buttonByText(container, "Open Serapack folder").click();
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
		const { container } = await renderSerapackSelector({
			catalog: createCatalog({
				refreshFx: Effect.promise(() => refreshing),
			}),
			openUserDirectory,
		});
		const refreshButton = buttonByText(container, "Refresh");
		const folderButton = buttonByText(container, "Open Serapack folder");

		await act(async () => {
			refreshButton.click();
			await Promise.resolve();
		});
		expect(container.textContent).not.toContain("Refreshing packages…");
		expect(container.textContent).toContain("Custom Serakki");
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
		openEditorSerapack.mockReturnValue({
			projectId: "serakki",
		});
		const { container, router } = await renderSerapackSelector({
			catalog: createCatalog(),
		});

		await act(async () => {
			buttonByText(container, "Editor").click();
			await Promise.resolve();
			await Promise.resolve();
		});

		expect(openEditorSerapack).toHaveBeenCalledWith("serakki");
		expect(router.state.location.pathname).toBe("/editor/serakki/editor/items/list");
	});
});
