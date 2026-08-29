// @vitest-environment jsdom

import { Effect, SubscriptionRef } from "effect";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ArkpackCatalog } from "~/arkpack/renderer/ArkpackCatalog";
import {
	cleanupArkpackSelectorTests,
	renderArkpackSelector,
} from "~test/arkpack/ui/ArkpackSelector.test/fixture";

afterEach(async () => {
	await cleanupArkpackSelectorTests();
	vi.restoreAllMocks();
});

describe("ArkpackSelector", () => {
	it("shows catalog provenance and returns to the main menu", async () => {
		const catalogState = {
			type: "ready" as const,
			arkpacks: [
				{
					packageId: "package:built-in",
					contentHash: "a".repeat(64),
					title: "Arkini",
					version: "1.0",
					arkini: "1",
					provenance: {
						type: "official",
					} as const,
					source: "bundled" as const,
					overridesBundled: false,
				},
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
			importFileFx: () => Effect.die("unused"),
			installFx: () => Effect.die("unused"),
			removeFx: () => Effect.die("unused"),
		};
		const { container, router } = await renderArkpackSelector({
			catalog,
		});

		const layout = container.querySelector('[data-ui="ArkpackSelector"]');
		const catalogList = container.querySelector<HTMLElement>('[data-ui="ArkpackCatalogList"]');
		const catalogRows = Array.from(
			catalogList?.querySelectorAll<HTMLElement>('[data-ui="ArkpackCatalogRow"]') ?? [],
		);
		expect(catalogRows).toHaveLength(2);
		expect(catalogRows[0]?.textContent).toContain("Official");
		expect(catalogRows[1]?.textContent).toContain("Community");
		const returnButton = layout?.lastElementChild?.querySelector("button");

		await act(async () => returnButton?.click());
		expect(router.state.location.pathname).toBe("/main-menu");
	});
});
