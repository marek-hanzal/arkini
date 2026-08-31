import { Effect, SubscriptionRef } from "effect";
import { describe, expect, it, vi } from "vitest";

import { ArkiniAppVersion } from "~shared/ArkiniAppMetadata";
import type { ArkpackDescriptor } from "~/arkpack-catalog/type/ArkpackDescriptor";
import { createArkpackCatalogFx } from "~/arkpack-catalog/fx/createArkpackCatalogFx";
import { installBuiltEditorArkpackFx } from "~/editor-build/fx/installBuiltEditorArkpackFx";
import { readEditorBuildInstallPlanFn } from "~/editor-build/fn/readEditorBuildInstallPlanFn";
import type { EditorProjectBuildSchema } from "~/editor-build/schema/EditorProjectBuildSchema";

const artifact: EditorProjectBuildSchema.Type = {
	projectId: "project:build",
	revision: 7,
	contentHash: "b".repeat(64),
	size: 1,
	diagnostics: [],
};

const descriptor = (
	version: ArkpackDescriptor["version"],
	source: ArkpackDescriptor["source"] = "user",
	contentHash = "a".repeat(64),
): ArkpackDescriptor => ({
	packageId: artifact.projectId,
	contentHash,
	title: "Installed title is not identity",
	version,
	arkini: ArkiniAppVersion,
	provenance: {
		type: "community",
	},
	source,
});

describe("Editor Build install admission", () => {
	it("classifies canonical bundled and user package identities independently of presentation", async () => {
		const initial = readEditorBuildInstallPlanFn({
			arkpacks: [
				descriptor("1.0", "bundled"),
			],
			artifact: {
				...artifact,
				projectId: "project:other",
			},
			targetVersion: "1.0",
		});
		expect(initial.action).toBe("install");

		const bundledUpdate = readEditorBuildInstallPlanFn({
			arkpacks: [
				descriptor("1.4", "bundled"),
			],
			artifact,
			targetVersion: "1.9",
		});
		expect(bundledUpdate).toMatchObject({
			action: "update",
			expectedCurrent: {
				packageId: artifact.projectId,
				version: "1.4",
			},
		});
		expect(bundledUpdate.confirmation).toBeUndefined();
	});

	it.each([
		[
			"1.9",
			"2.0",
		],
		[
			"2.0",
			"1.9",
		],
	] as const)("requires confirmation for gameplay major mismatch %s → %s", async (from, to) => {
		const plan = readEditorBuildInstallPlanFn({
			arkpacks: [
				descriptor(from),
			],
			artifact,
			targetVersion: to,
		});
		expect(plan.confirmation).toEqual({
			installedContentHash: "a".repeat(64),
			installedVersion: from,
			targetContentHash: artifact.contentHash,
			targetVersion: to,
		});
	});

	it("blocks an unconfirmed major update before artifact read or catalog mutation", async () => {
		const installed = descriptor("1.5");
		const install = vi.fn(() =>
			Effect.succeed(descriptor("2.0", "user", artifact.contentHash)),
		);
		const catalog = Effect.runSync(
			createArkpackCatalogFx({
				listFx: Effect.succeed([
					installed,
				]),
				installFx: install,
			}),
		);
		await Effect.runPromise(catalog.refreshFx);
		const readProjectBuildFx = vi.fn(() =>
			Effect.succeed({
				bytes: new Uint8Array([
					1,
				]),
			}),
		);

		await expect(
			Effect.runPromise(
				installBuiltEditorArkpackFx({
					artifact,
					catalog,
					repository: {
						readProjectBuildFx,
					},
					targetVersion: "2.0",
				}),
			),
		).rejects.toThrow("requires confirmation");
		expect(readProjectBuildFx).not.toHaveBeenCalled();
		expect(install).not.toHaveBeenCalled();

		const plan = readEditorBuildInstallPlanFn({
			arkpacks: [
				installed,
			],
			artifact,
			targetVersion: "2.0",
		});
		await expect(
			Effect.runPromise(
				installBuiltEditorArkpackFx({
					artifact,
					catalog,
					confirmation: plan.confirmation,
					repository: {
						readProjectBuildFx,
					},
					targetVersion: "2.0",
				}),
			),
		).resolves.toMatchObject({
			packageId: artifact.projectId,
			version: "2.0",
		});
		expect(readProjectBuildFx).toHaveBeenCalledOnce();
		expect(install).toHaveBeenCalledOnce();
	});

	it("installs a same-major update and publishes the refreshed catalog before settling", async () => {
		let descriptors = [
			descriptor("1.2"),
		];
		const updated = descriptor("1.9", "user", artifact.contentHash);
		const install = vi.fn(() =>
			Effect.sync(() => {
				descriptors = [
					updated,
				];
				return updated;
			}),
		);
		const catalog = Effect.runSync(
			createArkpackCatalogFx({
				listFx: Effect.sync(() => descriptors),
				installFx: install,
			}),
		);
		await Effect.runPromise(catalog.refreshFx);

		await Effect.runPromise(
			installBuiltEditorArkpackFx({
				artifact,
				catalog,
				repository: {
					readProjectBuildFx: () =>
						Effect.succeed({
							bytes: new Uint8Array([
								1,
							]),
						}),
				},
				targetVersion: "1.9",
			}),
		);
		expect(Effect.runSync(SubscriptionRef.get(catalog.state))).toEqual({
			type: "ready",
			arkpacks: [
				updated,
			],
		});
	});
});
