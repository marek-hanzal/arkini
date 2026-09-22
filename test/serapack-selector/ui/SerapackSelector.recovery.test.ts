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

describe("SerapackSelector action recovery", () => {
	it("releases removal ownership after a rejected mutation so the action can retry", async () => {
		const removeFx = vi
			.fn<SerapackCatalog["removeFx"]>()
			.mockReturnValueOnce(Effect.fail(new Error("removal rejected")))
			.mockReturnValue(Effect.void);
		const catalog: SerapackCatalog = {
			awaitIdleFx: Effect.void,
			state: Effect.runSync(
				SubscriptionRef.make<SerapackCatalog.State>({
					type: "ready",
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
				}),
			),
			refreshFx: Effect.void,
			importFileFx: () => Effect.die("Unexpected import."),
			installFx: () => Effect.die("unused"),
			removeFx,
		};
		const { container } = await renderSerapackSelector({
			catalog,
		});
		const removeButton = container.querySelector<HTMLButtonElement>(
			'[data-ui="YourGamesRow"] button',
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
		const importFileFx = vi.fn(() => Effect.succeed(imported));
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
			removeFx: () => Effect.die("Unexpected removal."),
		};
		const { container, router } = await renderSerapackSelector({
			catalog,
		});
		const navigate = vi
			.spyOn(router, "navigate")
			.mockRejectedValueOnce(new Error("load navigation rejected"));
		const importButton = container.querySelector<HTMLButtonElement>(
			'[data-ui="YourGamesSerapackImport"]',
		);
		if (importButton === null) throw new Error("Missing Serapack import control.");

		await act(async () => {
			importButton.click();
			importButton.click();
			await Promise.resolve();
			await Promise.resolve();
		});

		expect(importFileFx).toHaveBeenCalledTimes(1);
		await vi.waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
		await vi.waitFor(() => expect(container.textContent).toContain("load navigation rejected"));
		expect(importButton.disabled).toBe(false);
		expect(router.state.location.pathname).toBe("/serapacks");

		await act(async () => {
			importButton.click();
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
