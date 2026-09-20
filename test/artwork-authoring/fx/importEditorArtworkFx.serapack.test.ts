// @vitest-environment jsdom

import { scheduleTask } from "@effect/atom-react";
import { Effect } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";

import type { SerakkiElectronApi } from "~electron/contract/SerakkiElectronApi";
import { importEditorArtworkFx } from "~/artwork-authoring/fx/importEditorArtworkFx";
import { ProjectWriteAdmission } from "~/project-authoring/service/ProjectWriteAdmission";
import { createProjectWriteAdmissionFx } from "~/project-authoring/fx/createProjectWriteAdmissionFx";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";

describe("Artwork Authoring importEditorArtworkFx from Serapack", () => {
	it("passes the selected Serapack path to the native importer", async () => {
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
		const importResourcesFn = vi.fn<SerakkiElectronApi.Api["editor"]["importResourcesFn"]>(
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
		Object.defineProperty(window, "serakki", {
			configurable: true,
			value: {
				file: {
					readPathFn: () => "/selected/source.serapack",
				},
				editor: {
					importResourcesFn,
				},
			} as unknown as SerakkiElectronApi.Api,
		});
		const registry = AtomRegistry.make({
			scheduleTask,
		});

		await Effect.runPromise(
			importEditorArtworkFx({
				file: new File([], "source.serapack"),
				projectId: "target-project",
				source: "serapack",
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
					name: "source.serapack",
					path: "/selected/source.serapack",
				},
			],
			projectId: "target-project",
			source: "serapack",
			type: "artwork",
		});
		registry.dispose();
	});
});
