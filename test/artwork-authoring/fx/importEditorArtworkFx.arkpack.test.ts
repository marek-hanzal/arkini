// @vitest-environment jsdom

import { scheduleTask } from "@effect/atom-react";
import { Effect } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";

import type { ArkiniElectronApi } from "~electron/contract/ArkiniElectronApi";
import { importEditorArtworkFx } from "~/artwork-authoring/fx/importEditorArtworkFx";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";

describe("Artwork Authoring importEditorArtworkFx from Arkpack", () => {
	it("passes the selected Arkpack path to the native importer", async () => {
		const project = {
			projectId: "target-project",
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
		const importResourcesFn = vi.fn<ArkiniElectronApi.Api["editor"]["importResourcesFn"]>(
			async () => ({
				type: "success",
				value: {
					project,
					resourceIds: [
						"hero",
					],
				},
			}),
		);
		Object.defineProperty(window, "arkini", {
			configurable: true,
			value: {
				file: {
					readPathFn: () => "/selected/source.arkpack",
				},
				editor: {
					importResourcesFn,
				},
			} as unknown as ArkiniElectronApi.Api,
		});
		const registry = AtomRegistry.make({
			scheduleTask,
		});

		await Effect.runPromise(
			importEditorArtworkFx({
				file: new File([], "source.arkpack"),
				projectId: "target-project",
				source: "arkpack",
			}).pipe(Effect.provideService(AtomRegistry.AtomRegistry, registry)),
		);

		expect(importResourcesFn).toHaveBeenCalledWith({
			files: [
				{
					name: "source.arkpack",
					path: "/selected/source.arkpack",
				},
			],
			projectId: "target-project",
			source: "arkpack",
			type: "artwork",
		});
		registry.dispose();
	});
});
