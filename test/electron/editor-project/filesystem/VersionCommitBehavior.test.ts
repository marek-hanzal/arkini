import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	createProjectTestHarness,
	type ProjectTestHarness,
} from "./support/createProjectTestHarness";

let harness: ProjectTestHarness;

beforeEach(async () => {
	harness = await createProjectTestHarness("arkini-version-commit-behavior-");
});

afterEach(async () => harness.close());

describe("filesystem Editor Version commit behavior", () => {
	it("keeps scenario-only commits on the same Arkpack version", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository, "scenario-version");
		const initialStatus = await Effect.runPromise(
			repository.readVersionStatusFx(project.projectId),
		);
		await Effect.runPromise(
			repository.createVersionFx({
				expectedFingerprint: initialStatus.currentFingerprint,
				projectId: project.projectId,
				subject: "Initial",
			}),
		);
		await Effect.runPromise(
			repository.writeBoardScenarioFx({
				bytes: Uint8Array.of(1, 2, 3),
				expectedRevision: project.revision,
				name: "Opening",
				projectId: project.projectId,
			}),
		);
		const preview = await Effect.runPromise(
			repository.previewVersionCommitFx(project.projectId),
		);
		expect(preview).toMatchObject({
			bump: "noop",
			nextArkpackVersion: "1.0",
			scenariosToDelete: [],
		});
		const committed = await Effect.runPromise(
			repository.createVersionFx({
				expectedFingerprint: preview.currentFingerprint,
				projectId: project.projectId,
				subject: "Add scenario",
			}),
		);

		expect(committed.arkpackVersion).toBe("1.0");
		expect(
			await Effect.runPromise(repository.listBoardScenariosFx(project.projectId)),
		).toHaveLength(1);
	});

	it("allows sibling branches to receive the same derived version", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository, "parallel-version");
		const initialStatus = await Effect.runPromise(
			repository.readVersionStatusFx(project.projectId),
		);
		const initial = await Effect.runPromise(
			repository.createVersionFx({
				expectedFingerprint: initialStatus.currentFingerprint,
				projectId: project.projectId,
				subject: "Initial",
			}),
		);
		const firstChange = await Effect.runPromise(
			repository.replaceConfigFx({
				config: {
					...project.config,
					meta: {
						...project.config.meta,
						title: "Branch A",
					},
				},
				expectedRevision: project.revision,
				projectId: project.projectId,
			}),
		);
		const firstStatus = await Effect.runPromise(
			repository.readVersionStatusFx(project.projectId),
		);
		const first = await Effect.runPromise(
			repository.createVersionFx({
				expectedFingerprint: firstStatus.currentFingerprint,
				projectId: project.projectId,
				subject: "Branch A",
			}),
		);
		expect(firstChange.version).toBe("1.0");
		expect(first.arkpackVersion).toBe("1.1");

		await Effect.runPromise(
			repository.checkoutVersionFx({
				projectId: project.projectId,
				versionId: initial.versionId,
			}),
		);
		const restored = await Effect.runPromise(repository.readProjectFx(project.projectId));
		if (restored === null) throw new Error("Restored project is missing.");
		await Effect.runPromise(
			repository.replaceConfigFx({
				config: {
					...restored.config,
					meta: {
						...restored.config.meta,
						title: "Branch B",
					},
				},
				expectedRevision: restored.revision,
				projectId: project.projectId,
			}),
		);
		const secondStatus = await Effect.runPromise(
			repository.readVersionStatusFx(project.projectId),
		);
		const second = await Effect.runPromise(
			repository.createVersionFx({
				expectedFingerprint: secondStatus.currentFingerprint,
				projectId: project.projectId,
				subject: "Branch B",
			}),
		);

		expect(second.parentVersionId).toBe(initial.versionId);
		expect(second.arkpackVersion).toBe("1.1");
		expect(first.versionId).not.toBe(second.versionId);
	});

	it("reuses an identical immutable child without rewriting its descriptor", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository, "repeated-version");
		const initialPreview = await Effect.runPromise(
			repository.previewVersionCommitFx(project.projectId),
		);
		const initial = await Effect.runPromise(
			repository.createVersionFx({
				expectedFingerprint: initialPreview.currentFingerprint,
				projectId: project.projectId,
				subject: "Initial",
			}),
		);
		const changeTitle = async () => {
			const current = await Effect.runPromise(repository.readProjectFx(project.projectId));
			if (current === null) throw new Error("Current project is missing.");
			await Effect.runPromise(
				repository.replaceConfigFx({
					config: {
						...current.config,
						meta: {
							...current.config.meta,
							title: "Repeated child",
						},
					},
					expectedRevision: current.revision,
					projectId: current.projectId,
				}),
			);
		};
		await changeTitle();
		const firstPreview = await Effect.runPromise(
			repository.previewVersionCommitFx(project.projectId),
		);
		const first = await Effect.runPromise(
			repository.createVersionFx({
				expectedFingerprint: firstPreview.currentFingerprint,
				projectId: project.projectId,
				subject: "Same child",
			}),
		);
		const root = await Effect.runPromise(repository.readProjectRootFx(project.projectId));
		if (root === null) throw new Error("Project root is missing.");
		const descriptorPath = join(root, "versions", first.versionId, "version.json");
		const firstBytes = await readFile(descriptorPath);

		await Effect.runPromise(
			repository.checkoutVersionFx({
				projectId: project.projectId,
				versionId: initial.versionId,
			}),
		);
		await changeTitle();
		const repeatedPreview = await Effect.runPromise(
			repository.previewVersionCommitFx(project.projectId),
		);
		const repeated = await Effect.runPromise(
			repository.createVersionFx({
				expectedFingerprint: repeatedPreview.currentFingerprint,
				projectId: project.projectId,
				subject: "Same child",
			}),
		);

		expect(repeated).toEqual(first);
		expect(await readFile(descriptorPath)).toEqual(firstBytes);
		expect(await Effect.runPromise(repository.listVersionsFx(project.projectId))).toHaveLength(
			2,
		);
	});
});
