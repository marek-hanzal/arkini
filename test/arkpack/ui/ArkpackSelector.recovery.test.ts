// @vitest-environment jsdom

import { Effect, SubscriptionRef } from "effect";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ArkpackDescriptor } from "~/arkpack-catalog/type/ArkpackDescriptor";
import type { ArkpackCatalog } from "~/arkpack-catalog/service/ArkpackCatalog";
import {
	cleanupArkpackSelectorTests,
	renderArkpackSelector,
} from "~test/arkpack/ui/ArkpackSelector.test/fixture";

afterEach(async () => {
	await cleanupArkpackSelectorTests();
	vi.restoreAllMocks();
});

describe("ArkpackSelector action recovery", () => {
	it("releases removal ownership after a rejected mutation so the action can retry", async () => {
		const removeFx = vi
			.fn<ArkpackCatalog["removeFx"]>()
			.mockReturnValueOnce(Effect.fail(new Error("removal rejected")))
			.mockReturnValue(Effect.void);
		const catalog: ArkpackCatalog = {
			awaitIdleFx: Effect.void,
			state: Effect.runSync(
				SubscriptionRef.make<ArkpackCatalog.State>({
					type: "ready",
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
				}),
			),
			refreshFx: Effect.void,
			importFileFx: () => Effect.die("Unexpected import."),
			installFx: () => Effect.die("unused"),
			removeFx,
		};
		const { container } = await renderArkpackSelector({
			catalog,
		});
		const removeButton = container.querySelector<HTMLButtonElement>(
			'[data-ui="ArkpackCatalogRow"] button',
		);
		if (removeButton === null) throw new Error("Missing Remove action.");

		await act(async () => {
			removeButton.click();
			removeButton.click();
			await Promise.resolve();
			await Promise.resolve();
		});

		expect(removeFx).toHaveBeenCalledTimes(1);
		await vi.waitFor(() => expect(container.textContent).toContain("removal rejected"));
		expect(removeButton.disabled).toBe(false);

		await act(async () => {
			removeButton.click();
			await Promise.resolve();
			await Promise.resolve();
		});
		expect(removeFx).toHaveBeenCalledTimes(2);
		expect(removeButton.disabled).toBe(false);
	});

	it("deduplicates import and releases it after rejected destination navigation", async () => {
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
		const importFileFx = vi.fn(() => Effect.succeed(imported));
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
			removeFx: () => Effect.die("Unexpected removal."),
		};
		const { container, router } = await renderArkpackSelector({
			catalog,
		});
		const navigate = vi
			.spyOn(router, "navigate")
			.mockRejectedValueOnce(new Error("load navigation rejected"));
		const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
		if (fileInput === null) throw new Error("Missing Arkpack file input.");
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
			fileInput.dispatchEvent(
				new Event("change", {
					bubbles: true,
				}),
			);
			await Promise.resolve();
			await Promise.resolve();
		});

		expect(importFileFx).toHaveBeenCalledTimes(1);
		await vi.waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
		await vi.waitFor(() => expect(container.textContent).toContain("load navigation rejected"));
		expect(fileInput.disabled).toBe(false);
		expect(router.state.location.pathname).toBe("/arkpacks");

		await act(async () => {
			fileInput.dispatchEvent(
				new Event("change", {
					bubbles: true,
				}),
			);
			await Promise.resolve();
			await Promise.resolve();
		});
		await vi.waitFor(() =>
			expect(router.state.location.pathname).toBe("/action/load-game/package%3Aimported"),
		);
		expect(importFileFx).toHaveBeenCalledTimes(2);
		expect(navigate).toHaveBeenCalledTimes(2);
	});
});
