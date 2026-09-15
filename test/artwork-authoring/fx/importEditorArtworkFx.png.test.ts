// @vitest-environment jsdom

import { scheduleTask } from "@effect/atom-react";
import { Effect } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ArkiniElectronApi } from "~electron/contract/ArkiniElectronApi";
import { importEditorArtworkFx } from "~/artwork-authoring/fx/importEditorArtworkFx";
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

describe("Artwork Authoring importEditorArtworkFx from PNG files", () => {
	it("passes only native paths over IPC and publishes the imported project", async () => {
		const importResourcesFn = vi.fn<ArkiniElectronApi.Api["editor"]["importResourcesFn"]>(
			async () => ({
				type: "success",
				value: {
					project,
					resourceIds: [
						"new-artwork",
						"other-artwork",
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
					importResourcesFn,
				},
			} as unknown as ArkiniElectronApi.Api,
		});
		const registry = AtomRegistry.make({
			scheduleTask,
		});
		const files = [
			new File([], "New Artwork.png"),
			new File([], "Other Artwork.png"),
		];

		const imported = await Effect.runPromise(
			importEditorArtworkFx({
				projectId: "project",
				source: "files",
				files,
			}).pipe(Effect.provideService(AtomRegistry.AtomRegistry, registry)),
		);

		expect(importResourcesFn).toHaveBeenCalledWith({
			files: [
				{
					name: "New Artwork.png",
					path: "/selected/New Artwork.png",
				},
				{
					name: "Other Artwork.png",
					path: "/selected/Other Artwork.png",
				},
			],
			projectId: "project",
			source: "files",
			type: "artwork",
		});
		expect(imported.resourceIds).toEqual([
			"new-artwork",
			"other-artwork",
		]);
		expect(registry.get(EditorProjectAtom("project"))?.revision).toBe(2);
		registry.dispose();
	});
});
