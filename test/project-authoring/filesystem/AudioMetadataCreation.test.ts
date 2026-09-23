import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect } from "effect";
import { expect, it } from "vitest";

import { importEditorResourceFilesFx } from "~electron/main/editor-project/importEditorResourceFilesFx";
import { packDirectoryFx } from "~/serapack-artifact/fx/packDirectoryFx";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";
import { createTestOggOpusBytesFn } from "~test/game-config-resource/support/createTestOggOpusBytesFn";
import { createProjectTestHarness } from "./support/createProjectTestHarness";

it("creates nonempty metadata for separator-only IDs through project creation and both Serapack imports", async () => {
	const sourceHarness = await createProjectTestHarness("serakki-audio-name-source-");
	const targetHarness = await createProjectTestHarness("serakki-audio-name-target-");
	try {
		const sourceRepository = await sourceHarness.openRepository();
		const sourceProject = await Effect.runPromise(
			sourceRepository.createProjectFx({
				version: {
					major: 1,
					minor: 0,
				},
				config: {
					...editorTestPayload.config,
					sfx: {
						events: {
							"job:started": "---",
						},
					},
				},
				resources: [
					...editorTestPayload.resources,
					{
						uid: "---",
						type: "sfx",
						bytes: createTestOggOpusBytesFn(),
					},
				],
			}),
		);
		expect(sourceProject.resources.find(({ uid }) => uid === "---")).toMatchObject({
			title: "---",
		});
		const named = await Effect.runPromise(
			sourceRepository.saveResourceMetadataFx({
				projectId: sourceProject.projectId,
				expectedRevision: sourceProject.revision,
				resourceUid: "---",
				title: "Authored source name",
			}),
		);
		const sourceRoot = await Effect.runPromise(
			sourceRepository.readProjectRootFx(named.projectId),
		);
		if (sourceRoot === null) throw new Error("Missing source project root");
		const packed = await Effect.runPromise(
			packDirectoryFx({
				input: sourceRoot,
			}).pipe(Effect.provide(NodeServices.layer)),
		);
		const targetRepository = await targetHarness.openRepository();
		const importedProject = await Effect.runPromise(
			targetRepository.importSerapackFileFx(packed.serapack),
		);
		expect(importedProject.resources.find(({ uid }) => uid === "---")).toMatchObject({
			title: "---",
			type: "sfx",
		});
		expect(importedProject.config.sfx?.events["job:started"]).toBe("---");

		const resourceTarget = await targetHarness.createProject(
			targetRepository,
			"resource-target",
		);
		const importedResource = await Effect.runPromise(
			importEditorResourceFilesFx({
				repository: targetRepository,
				request: {
					projectId: resourceTarget.projectId,
					source: "serapack",
					type: "sfx",
					files: [
						{
							name: "source.serapack",
							path: packed.serapack,
						},
					],
				},
			}),
		);
		expect(importedResource.resourceUids).toEqual([
			"---",
		]);
		expect(importedResource.project.resources.find(({ uid }) => uid === "---")).toMatchObject({
			title: "---",
			type: "sfx",
		});
		expect(
			(await Effect.runPromise(targetRepository.refreshProjectFx(resourceTarget.projectId)))
				.resources,
		).toEqual(importedResource.project.resources);
	} finally {
		await sourceHarness.close();
		await targetHarness.close();
	}
});
