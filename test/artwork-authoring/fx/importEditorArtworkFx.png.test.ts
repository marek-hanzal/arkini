// @vitest-environment jsdom

import { scheduleTask } from "@effect/atom-react";
import { Effect } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SerakkiElectronApi } from "~electron/contract/SerakkiElectronApi";
import { importEditorArtworkFx } from "~/artwork-authoring/fx/importEditorArtworkFx";
import { EditorProjectAtom } from "~/authoring-session/atom/EditorProjectAtom";
import { ProjectWriteAdmission } from "~/project-authoring/service/ProjectWriteAdmission";
import { createProjectWriteAdmissionFx } from "~/project-authoring/fx/createProjectWriteAdmissionFx";
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
		const importResourcesFn = vi.fn<SerakkiElectronApi.Api["editor"]["importResourcesFn"]>(
			async () => ({
				type: "success",
				value: {
					project,
					resourceUids: [
						"new-artwork",
						"other-artwork",
					],
				},
			}),
		);
		vi.stubGlobal("serakki", undefined);
		Object.defineProperty(window, "serakki", {
			configurable: true,
			value: {
				file: {
					readPathFn: (file: File) => `/selected/${file.name}`,
				},
				editor: {
					importResourcesFn,
				},
			} as unknown as SerakkiElectronApi.Api,
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
			}).pipe(
				Effect.provideService(AtomRegistry.AtomRegistry, registry),
				Effect.provideService(
					ProjectWriteAdmission,
					Effect.runSync(createProjectWriteAdmissionFx),
				),
			),
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
		expect(imported.resourceUids).toEqual([
			"new-artwork",
			"other-artwork",
		]);
		expect(registry.get(EditorProjectAtom("project"))?.revision).toBe(2);
		registry.dispose();
	});
});
