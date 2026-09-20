import { Effect, SubscriptionRef } from "effect";
import { describe, expect, it, vi } from "vitest";

import { SerakkiAppVersion } from "~shared/SerakkiAppMetadata";
import type { SerapackDescriptor } from "~/serapack-catalog/type/SerapackDescriptor";
import { createSerapackCatalogFx } from "~/serapack-catalog/fx/createSerapackCatalogFx";
import { installBuiltEditorSerapackFx } from "~/editor-build/fx/installBuiltEditorSerapackFx";
import { readEditorBuildInstallPlanFn } from "~/editor-build/fn/readEditorBuildInstallPlanFn";
import type { EditorProjectBuildSchema } from "~/editor-build/schema/EditorProjectBuildSchema";

const artifact: EditorProjectBuildSchema.Type = {
	projectId: "project:build",
	version: "1.0",
	revision: 7,
	contentHash: "b".repeat(64),
	size: 1,
	diagnostics: [],
};

const descriptor = (
	version: SerapackDescriptor["version"],
	source: SerapackDescriptor["source"] = "user",
	contentHash = "a".repeat(64),
): SerapackDescriptor => ({
	packageId: artifact.projectId,
	contentHash,
	title: "Installed title is not identity",
	version,
	serakki: SerakkiAppVersion,
	provenance: {
		type: "community",
	},
	source,
});

describe("Editor Build install admission", () => {
	it("classifies canonical bundled and user package identities independently of presentation", async () => {
		const initial = readEditorBuildInstallPlanFn({
			serapacks: [
				descriptor("1.0", "bundled"),
			],
			artifact: {
				...artifact,
				version: "1.0",
				projectId: "project:other",
			},
		});
		expect(initial.action).toBe("install");

		const bundledUpdate = readEditorBuildInstallPlanFn({
			serapacks: [
				descriptor("1.4", "bundled"),
			],
			artifact: {
				...artifact,
				version: "1.9",
			},
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
			serapacks: [
				descriptor(from),
			],
			artifact: {
				...artifact,
				version: to,
			},
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
			createSerapackCatalogFx({
				listFx: Effect.succeed([
					installed,
				]),
				installFx: install,
			}),
		);
		await Effect.runPromise(catalog.refreshFx);
		await expect(
			Effect.runPromise(
				installBuiltEditorSerapackFx({
					artifact: {
						...artifact,
						version: "2.0",
					},
					catalog,
				}),
			),
		).rejects.toThrow("requires confirmation");
		expect(install).not.toHaveBeenCalled();

		const plan = readEditorBuildInstallPlanFn({
			serapacks: [
				installed,
			],
			artifact: {
				...artifact,
				version: "2.0",
			},
		});
		await expect(
			Effect.runPromise(
				installBuiltEditorSerapackFx({
					artifact: {
						...artifact,
						version: "2.0",
					},
					catalog,
					confirmation: plan.confirmation,
				}),
			),
		).resolves.toMatchObject({
			packageId: artifact.projectId,
			version: "2.0",
		});
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
			createSerapackCatalogFx({
				listFx: Effect.sync(() => descriptors),
				installFx: install,
			}),
		);
		await Effect.runPromise(catalog.refreshFx);

		await Effect.runPromise(
			installBuiltEditorSerapackFx({
				artifact: {
					...artifact,
					version: "1.9",
				},
				catalog,
			}),
		);
		expect(Effect.runSync(SubscriptionRef.get(catalog.state))).toEqual({
			type: "ready",
			serapacks: [
				updated,
			],
		});
	});
});
