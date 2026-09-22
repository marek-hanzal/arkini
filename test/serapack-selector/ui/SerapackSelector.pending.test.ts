// @vitest-environment jsdom

import { Effect, SubscriptionRef } from "effect";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SerapackDescriptor } from "~/serapack-catalog/type/SerapackDescriptor";
import type { SerapackCatalog } from "~/serapack-catalog/service/SerapackCatalog";
import {
	cleanupSerapackSelectorTests,
	renderSerapackSelector,
} from "~test/serapack-selector/ui/SerapackSelector.test/fixture";

afterEach(async () => {
	await cleanupSerapackSelectorTests();
	vi.restoreAllMocks();
});

describe("SerapackSelector pending actions", () => {
	it("blocks Remove, Play, and import while an exact removal is pending", async () => {
		let finishRemove!: () => void;
		const removal = new Promise<void>((resolve) => {
			finishRemove = resolve;
		});
		const importFileFx = vi.fn<SerapackCatalog["importFileFx"]>(() =>
			Effect.die("Unexpected import."),
		);
		const removeFx = vi.fn(() => Effect.promise(() => removal));
		const catalogState = {
			type: "ready" as const,
			serapacks: [
				{
					packageId: "package:local",
					contentHash: "b".repeat(64),
					title: "Local package",
					version: "1.0",
					serakki: "1",
					provenance: {
						type: "community",
					} as const,
					source: "user" as const,
					overridesBundled: false,
					filename: "local.serapack",
				},
			],
		};
		const catalog: SerapackCatalog = {
			awaitIdleFx: Effect.void,
			state: Effect.runSync(SubscriptionRef.make<SerapackCatalog.State>(catalogState)),
			refreshFx: Effect.void,
			importFileFx,
			installFx: () => Effect.die("unused"),
			removeFx,
		};
		const { container, router } = await renderSerapackSelector({
			catalog,
		});
		const removeButton = container.querySelector<HTMLButtonElement>(
			'[data-ui="YourGamesRow"] button',
		);
		const playLink = container.querySelector<HTMLAnchorElement>(
			'a[href="/action/load-game/package%3Alocal"]',
		);
		const importButton = container.querySelector<HTMLButtonElement>(
			'[data-ui="YourGamesSerapackImport"]',
		);
		if (removeButton === null || playLink === null || importButton === null) {
			throw new Error("Missing Serapack selector controls.");
		}

		await act(async () => {
			removeButton.click();
			await Promise.resolve();
		});

		expect(removeFx).toHaveBeenCalledTimes(1);
		expect(removeButton.disabled).toBe(true);
		expect(playLink.getAttribute("data-ui-disabled")).toBe("true");
		expect(importButton.disabled).toBe(true);

		await act(async () => {
			removeButton.click();
			playLink.click();
			importButton.click();
			await Promise.resolve();
		});
		expect(removeFx).toHaveBeenCalledTimes(1);
		expect(importFileFx).not.toHaveBeenCalled();
		expect(router.state.location.pathname).toBe("/serapacks");

		await act(async () => {
			finishRemove();
			await removal;
			await Promise.resolve();
			await Promise.resolve();
		});
		expect(removeButton.disabled).toBe(false);
		expect(playLink.getAttribute("data-ui-disabled")).toBe("false");
		expect(importButton.disabled).toBe(false);
	});

	it("blocks catalog actions and repeated file changes while import is pending", async () => {
		let finishImport!: (serapack: SerapackDescriptor) => void;
		const imported: SerapackDescriptor = {
			packageId: "package:imported",
			contentHash: "c".repeat(64),
			title: "Imported package",
			version: "1.0",
			serakki: "1",
			provenance: {
				type: "community",
			},
			source: "user",
			overridesBundled: false,
			filename: "imported.serapack",
		};
		const importing = new Promise<SerapackDescriptor>((resolve) => {
			finishImport = resolve;
		});
		const importFileFx = vi.fn(() => Effect.promise(() => importing));
		const removeFx = vi.fn(() => Effect.void);
		const catalog: SerapackCatalog = {
			awaitIdleFx: Effect.void,
			state: Effect.runSync(
				SubscriptionRef.make<SerapackCatalog.State>({
					type: "ready",
					serapacks: [
						imported,
					],
				}),
			),
			refreshFx: Effect.void,
			importFileFx,
			installFx: () => Effect.die("unused"),
			removeFx,
		};
		const { container, router } = await renderSerapackSelector({
			catalog,
		});
		const removeButton = container.querySelector<HTMLButtonElement>(
			'[data-ui="YourGamesRow"] button',
		);
		const playLink = container.querySelector<HTMLAnchorElement>(
			'a[href="/action/load-game/package%3Aimported"]',
		);
		const importButton = container.querySelector<HTMLButtonElement>(
			'[data-ui="YourGamesSerapackImport"]',
		);
		if (removeButton === null || playLink === null || importButton === null) {
			throw new Error("Missing Serapack selector controls.");
		}

		await act(async () => {
			importButton.click();
			await Promise.resolve();
		});
		expect(importFileFx).toHaveBeenCalledTimes(1);
		expect(removeButton.disabled).toBe(true);
		expect(playLink.getAttribute("data-ui-disabled")).toBe("true");
		expect(importButton.disabled).toBe(true);

		await act(async () => {
			importButton.click();
			removeButton.click();
			playLink.click();
			await Promise.resolve();
		});
		expect(importFileFx).toHaveBeenCalledTimes(1);
		expect(removeFx).not.toHaveBeenCalled();
		expect(router.state.location.pathname).toBe("/serapacks");

		await act(async () => {
			finishImport(imported);
			await importing;
			await Promise.resolve();
			await Promise.resolve();
		});
		expect(router.state.location.pathname).toBe("/action/load-game/package%3Aimported");
	});
});
