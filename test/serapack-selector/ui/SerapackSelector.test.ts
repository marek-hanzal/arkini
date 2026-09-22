// @vitest-environment jsdom

import { Effect, SubscriptionRef } from "effect";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProjectCandidate } from "~/project-authoring/schema/ProjectCandidateSchema";
import type { SerapackCatalog } from "~/serapack-catalog/service/SerapackCatalog";
import {
	cleanupSerapackSelectorTests,
	renderSerapackSelector,
} from "~test/serapack-selector/ui/SerapackSelector.test/fixture";

afterEach(async () => {
	await cleanupSerapackSelectorTests();
	vi.restoreAllMocks();
});

describe("SerapackSelector", () => {
	it("keeps Editor projects available when the Serapack catalog fails", async () => {
		const catalog: SerapackCatalog = {
			awaitIdleFx: Effect.void,
			state: Effect.runSync(
				SubscriptionRef.make<SerapackCatalog.State>({
					type: "failed",
					error: new Error("Package scan failed"),
				}),
			),
			refreshFx: Effect.void,
			importFileFx: () => Effect.die("unused"),
			installFx: () => Effect.die("unused"),
			removeFx: () => Effect.die("unused"),
		};
		const { container } = await renderSerapackSelector({
			catalog,
			projects: [
				{
					type: "valid",
					ownership: "managed",
					project: {
						projectId: "game:editor-only",
						title: "Editor game",
						version: {
							major: 1,
							minor: 0,
						},
						createdAtMs: 1,
						updatedAtMs: 2,
					},
				},
			],
		});

		expect(container.textContent).toContain("Package scan failed");
		expect(container.querySelector('[data-ui="YourGamesRow"]')?.textContent).toContain(
			"Editor game",
		);
	});

	it("shows one Editor-first row for a shared identity and keeps package-only games", async () => {
		const projects: ReadonlyArray<ProjectCandidate> = [
			{
				type: "valid",
				ownership: "managed",
				project: {
					projectId: "game:shared",
					title: "Editor title",
					version: {
						major: 1,
						minor: 0,
					},
					createdAtMs: 1,
					updatedAtMs: 30,
				},
			},
			{
				type: "valid",
				ownership: "external",
				project: {
					projectId: "game:project-only",
					title: "Project only",
					version: {
						major: 1,
						minor: 0,
					},
					createdAtMs: 1,
					updatedAtMs: 20,
				},
			},
		];
		const catalog: SerapackCatalog = {
			awaitIdleFx: Effect.void,
			state: Effect.runSync(
				SubscriptionRef.make<SerapackCatalog.State>({
					type: "ready",
					serapacks: [
						{
							packageId: "game:shared",
							contentHash: "a".repeat(64),
							title: "Packaged title",
							version: "1.0",
							serakki: "1",
							provenance: {
								type: "community",
							},
							source: "user",
							overridesBundled: false,
						},
						{
							packageId: "game:package-only",
							contentHash: "b".repeat(64),
							title: "Package only",
							version: "1.0",
							serakki: "1",
							provenance: {
								type: "community",
							},
							source: "user",
							overridesBundled: false,
						},
					],
				}),
			),
			refreshFx: Effect.void,
			importFileFx: () => Effect.die("unused"),
			installFx: () => Effect.die("unused"),
			removeFx: () => Effect.die("unused"),
		};
		const { container } = await renderSerapackSelector({
			catalog,
			projects,
		});
		const rows = Array.from(
			container.querySelectorAll<HTMLElement>('[data-ui="YourGamesRow"]'),
		);

		expect(rows).toHaveLength(3);
		expect(rows.map((row) => row.dataset.rowKind)).toEqual([
			"project",
			"project",
			"serapack",
		]);
		expect(rows[0]?.textContent).toContain("Editor title");
		expect(rows[0]?.textContent).not.toContain("Packaged title");
		expect(rows[0]?.querySelector('a[href="/action/load-game/game%3Ashared"]')).not.toBeNull();
		expect(rows[1]?.querySelector('a[href^="/action/load-game/"]')).toBeNull();
		expect(
			rows[1]?.querySelector('a[href="/editor/game%3Aproject-only/editor/items/list"]'),
		).not.toBeNull();
		expect(rows[2]?.textContent).toContain("Package only");
	});

	it("shows catalog provenance and returns to the main menu", async () => {
		const catalogState = {
			type: "ready" as const,
			serapacks: [
				{
					packageId: "package:built-in",
					contentHash: "a".repeat(64),
					title: "Serakki",
					version: "1.0",
					serakki: "1",
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
			importFileFx: () => Effect.die("unused"),
			installFx: () => Effect.die("unused"),
			removeFx: () => Effect.die("unused"),
		};
		const { container, router } = await renderSerapackSelector({
			catalog,
		});

		const layout = container.querySelector('[data-ui="SerapackSelector"]');
		const catalogList = container.querySelector<HTMLElement>('[data-ui="YourGamesList"]');
		const catalogRows = Array.from(
			catalogList?.querySelectorAll<HTMLElement>('[data-ui="YourGamesRow"]') ?? [],
		);
		expect(catalogRows).toHaveLength(2);
		expect(catalogRows[0]?.textContent).toContain("Community");
		expect(catalogRows[1]?.textContent).toContain("Official");
		const returnButton = layout?.lastElementChild?.querySelector("button");

		await act(async () => returnButton?.click());
		expect(router.state.location.pathname).toBe("/main-menu");
	});
});
