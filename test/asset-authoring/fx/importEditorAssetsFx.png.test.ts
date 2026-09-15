// @vitest-environment jsdom

import { scheduleTask } from "@effect/atom-react";
import { Effect } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ArkiniElectronApi } from "~electron/contract/ArkiniElectronApi";
import { importEditorAssetsFx } from "~/asset-authoring/fx/importEditorAssetsFx";
import { EditorProjectAtom } from "~/authoring-session/atom/EditorProjectAtom";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";

const project = {
	projectId: "project",
	title: editorTestPayload.config.meta.title,
	version: {
		major: 1,
		minor: 0,
	},
	createdAtMs: 1,
	updatedAtMs: 2,
	revision: 2,
	config: editorTestPayload.config,
	resources: [],
};

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("Asset Authoring importEditorAssetsFx from PNG files", () => {
	it("passes only native paths over IPC and publishes the imported project", async () => {
		const importAssetsFn = vi.fn<ArkiniElectronApi.Api["editor"]["importAssetsFn"]>(
			async () => ({
				type: "success",
				value: {
					project,
					resourceIds: [
						"new-asset",
						"other-asset",
					],
				},
			}),
		);
		vi.stubGlobal("arkini", undefined);
		Object.defineProperty(window, "arkini", {
			configurable: true,
			value: {
				file: {
					readPathFn: (file: File) => `/selected/${file.name}`,
				},
				editor: {
					importAssetsFn,
				},
			} as unknown as ArkiniElectronApi.Api,
		});
		const registry = AtomRegistry.make({
			scheduleTask,
		});
		const files = [
			new File([], "New Asset.png"),
			new File([], "Other Asset.png"),
		];

		const imported = await Effect.runPromise(
			importEditorAssetsFx({
				projectId: "project",
				source: "files",
				files,
			}).pipe(Effect.provideService(AtomRegistry.AtomRegistry, registry)),
		);

		expect(importAssetsFn).toHaveBeenCalledWith({
			files: [
				{
					name: "New Asset.png",
					path: "/selected/New Asset.png",
				},
				{
					name: "Other Asset.png",
					path: "/selected/Other Asset.png",
				},
			],
			projectId: "project",
			source: "files",
		});
		expect(imported.resourceIds).toEqual([
			"new-asset",
			"other-asset",
		]);
		expect(registry.get(EditorProjectAtom("project"))?.revision).toBe(2);
		registry.dispose();
	});
});
