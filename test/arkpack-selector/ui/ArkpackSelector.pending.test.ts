// @vitest-environment jsdom

import { Effect, SubscriptionRef } from "effect";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ArkpackDescriptor } from "~/arkpack-catalog/type/ArkpackDescriptor";
import type { ArkpackCatalog } from "~/arkpack-catalog/service/ArkpackCatalog";
import {
	cleanupArkpackSelectorTests,
	renderArkpackSelector,
} from "~test/arkpack-selector/ui/ArkpackSelector.test/fixture";

afterEach(async () => {
	await cleanupArkpackSelectorTests();
	vi.restoreAllMocks();
});

describe("ArkpackSelector pending actions", () => {
	it("blocks Remove, Play, and import while an exact removal is pending", async () => {
		let finishRemove!: () => void;
		const removal = new Promise<void>((resolve) => {
			finishRemove = resolve;
		});
		const importFileFx = vi.fn<ArkpackCatalog["importFileFx"]>(() =>
			Effect.die("Unexpected import."),
		);
		const removeFx = vi.fn(() => Effect.promise(() => removal));
		const catalogState = {
			type: "ready" as const,
			arkpacks: [
				{
					packageId: "package:local",
					contentHash: "b".repeat(64),
					title: "Local package",
					version: "1.0",
					arkini: "1",
					provenance: {
						type: "community",
					} as const,
					source: "user" as const,
					overridesBundled: false,
					filename: "local.arkpack",
				},
			],
		};
		const catalog: ArkpackCatalog = {
			awaitIdleFx: Effect.void,
			state: Effect.runSync(SubscriptionRef.make<ArkpackCatalog.State>(catalogState)),
			refreshFx: Effect.void,
			importFileFx,
			installFx: () => Effect.die("unused"),
			removeFx,
		};
		const { container, router } = await renderArkpackSelector({
			catalog,
		});
		const removeButton = container.querySelector<HTMLButtonElement>(
			'[data-ui="ArkpackCatalogRow"] button',
		);
		const playLink = container.querySelector<HTMLAnchorElement>(
			'a[href="/action/load-game/package%3Alocal"]',
		);
		const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
		if (removeButton === null || playLink === null || fileInput === null) {
			throw new Error("Missing Arkpack selector controls.");
		}

		await act(async () => {
			removeButton.click();
			await Promise.resolve();
		});

		expect(removeFx).toHaveBeenCalledTimes(1);
		expect(removeButton.disabled).toBe(true);
		expect(playLink.getAttribute("data-ui-disabled")).toBe("true");
		expect(fileInput.disabled).toBe(true);

		await act(async () => {
			removeButton.click();
			playLink.click();
			Object.defineProperty(fileInput, "files", {
				configurable: true,
				value: [
					new File(
						[
							"package",
						],
						"other.arkpack",
					),
				],
			});
			fileInput.dispatchEvent(
				new Event("change", {
					bubbles: true,
				}),
			);
			await Promise.resolve();
		});
		expect(removeFx).toHaveBeenCalledTimes(1);
		expect(importFileFx).not.toHaveBeenCalled();
		expect(router.state.location.pathname).toBe("/arkpacks");

		await act(async () => {
			finishRemove();
			await removal;
			await Promise.resolve();
			await Promise.resolve();
		});
		expect(removeButton.disabled).toBe(false);
		expect(playLink.getAttribute("data-ui-disabled")).toBe("false");
		expect(fileInput.disabled).toBe(false);
	});

	it("blocks catalog actions and repeated file changes while import is pending", async () => {
		let finishImport!: (arkpack: ArkpackDescriptor) => void;
		const imported: ArkpackDescriptor = {
			packageId: "package:imported",
			contentHash: "c".repeat(64),
			title: "Imported package",
			version: "1.0",
			arkini: "1",
			provenance: {
				type: "community",
			},
			source: "user",
			overridesBundled: false,
			filename: "imported.arkpack",
		};
		const importing = new Promise<ArkpackDescriptor>((resolve) => {
			finishImport = resolve;
		});
		const importFileFx = vi.fn(() => Effect.promise(() => importing));
		const removeFx = vi.fn(() => Effect.void);
		const catalog: ArkpackCatalog = {
			awaitIdleFx: Effect.void,
			state: Effect.runSync(
				SubscriptionRef.make<ArkpackCatalog.State>({
					type: "ready",
					arkpacks: [
						imported,
					],
				}),
			),
			refreshFx: Effect.void,
			importFileFx,
			installFx: () => Effect.die("unused"),
			removeFx,
		};
		const { container, router } = await renderArkpackSelector({
			catalog,
		});
		const removeButton = container.querySelector<HTMLButtonElement>(
			'[data-ui="ArkpackCatalogRow"] button',
		);
		const playLink = container.querySelector<HTMLAnchorElement>(
			'a[href="/action/load-game/package%3Aimported"]',
		);
		const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
		if (removeButton === null || playLink === null || fileInput === null) {
			throw new Error("Missing Arkpack selector controls.");
		}
		const file = new File(
			[
				"package",
			],
			"imported.arkpack",
		);
		Object.defineProperty(fileInput, "files", {
			configurable: true,
			value: [
				file,
			],
		});

		await act(async () => {
			fileInput.dispatchEvent(
				new Event("change", {
					bubbles: true,
				}),
			);
			await Promise.resolve();
		});
		expect(importFileFx).toHaveBeenCalledTimes(1);
		expect(removeButton.disabled).toBe(true);
		expect(playLink.getAttribute("data-ui-disabled")).toBe("true");
		expect(fileInput.disabled).toBe(true);

		await act(async () => {
			fileInput.dispatchEvent(
				new Event("change", {
					bubbles: true,
				}),
			);
			removeButton.click();
			playLink.click();
			await Promise.resolve();
		});
		expect(importFileFx).toHaveBeenCalledTimes(1);
		expect(removeFx).not.toHaveBeenCalled();
		expect(router.state.location.pathname).toBe("/arkpacks");

		await act(async () => {
			finishImport(imported);
			await importing;
			await Promise.resolve();
			await Promise.resolve();
		});
		expect(router.state.location.pathname).toBe("/action/load-game/package%3Aimported");
	});
});
