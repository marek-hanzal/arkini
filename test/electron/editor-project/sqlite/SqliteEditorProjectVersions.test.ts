import { DatabaseSync } from "node:sqlite";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ArkiniAppVersion } from "../../../../shared/ArkiniAppMetadata";
import {
	createSqliteEditorProjectTestHarness,
	type SqliteEditorProjectTestHarness,
} from "./support/createSqliteEditorProjectTestHarness";

let harness: SqliteEditorProjectTestHarness;

beforeEach(async () => (harness = await createSqliteEditorProjectTestHarness("arkini-versions-")));
afterEach(async () => harness.close());

describe("SQLite editor project versions", () => {
	it("snapshots every canonical project part and branches from the checked-out base", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository);
		const scenario = await Effect.runPromise(
			repository.writeBoardScenarioFx({
				projectId: project.projectId,
				expectedRevision: project.revision,
				name: "Opening",
				bytes: Uint8Array.of(7, 8),
			}),
		);
		const initialStatus = await Effect.runPromise(
			repository.readVersionStatusFx(project.projectId),
		);
		expect(initialStatus).toMatchObject({
			canCommit: true,
			dirty: true,
			versionCount: 0,
		});

		const root = await Effect.runPromise(
			repository.createVersionFx({
				body: "Everything starts here.",
				expectedFingerprint: initialStatus.currentFingerprint,
				projectId: project.projectId,
				subject: "Initial state",
				tag: "safe",
			}),
		);
		expect(root).toMatchObject({
			arkini: ArkiniAppVersion,
			arkpackVersion: "1.0",
			body: "Everything starts here.",
			projectId: project.projectId,
			snapshotFormatVersion: 1,
			sourceRevision: 0,
			subject: "Initial state",
			tag: "safe",
		});
		expect(root.parentVersionId).toBeUndefined();
		await expect(
			Effect.runPromise(
				repository.createVersionFx({
					projectId: project.projectId,
					subject: "No changes",
				}),
			),
		).rejects.toThrow("no changes");

		const renamed = await Effect.runPromise(
			repository.replaceConfigFx({
				projectId: project.projectId,
				expectedRevision: project.revision,
				config: {
					...project.config,
					meta: {
						...project.config.meta,
						title: "Experiment",
					},
				},
			}),
		);
		const changed = await Effect.runPromise(
			repository.upsertResourcesFx({
				projectId: project.projectId,
				resources: [
					{
						id: "hero",
						mime: "image/png",
						bytes: Uint8Array.of(9),
					},
				],
			}),
		);
		expect(changed.revision).toBe(renamed.revision + 1);
		const workingDiff = await Effect.runPromise(
			repository.diffVersionsFx({
				projectId: project.projectId,
				from: { type: "version", versionId: root.versionId },
				to: { type: "current" },
			}),
		);
		expect(workingDiff).toMatchObject({
			hasChanges: true,
			project: [
				{
					path: "arkpackVersion",
					before: "1.0",
					after: "1.2",
				},
				{
					path: "config.meta.title",
					before: project.title,
					after: "Experiment",
				},
			],
			items: [],
			resources: [{ change: "changed", id: "hero" }],
			scenarios: [],
		});
		const experiment = await Effect.runPromise(
			repository.createVersionFx({
				projectId: project.projectId,
				subject: "Try another hero",
			}),
		);
		expect(experiment.parentVersionId).toBe(root.versionId);
		expect(experiment.createdAtMs).toBeGreaterThan(root.createdAtMs);

		const restored = await Effect.runPromise(
			repository.checkoutVersionFx({
				projectId: project.projectId,
				versionId: root.versionId,
			}),
		);
		expect(restored.project).toMatchObject({
			config: project.config,
			revision: changed.revision + 1,
			version: "1.0",
		});
		expect(restored.project.resources).toEqual(project.resources);
		expect(
			await Effect.runPromise(
				repository.readBoardScenarioFx({
					projectId: project.projectId,
					name: scenario.name,
				}),
			),
		).toEqual({
			...scenario,
			projectRevision: restored.project.revision,
		});
		expect(await Effect.runPromise(repository.readVersionStatusFx(project.projectId))).toMatchObject(
			{
				canCommit: false,
				currentBaseVersionId: root.versionId,
				dirty: false,
				versionCount: 2,
			},
		);

		const branchProject = await Effect.runPromise(
			repository.replaceConfigFx({
				projectId: project.projectId,
				expectedRevision: restored.project.revision,
				config: {
					...restored.project.config,
					meta: {
						...restored.project.config.meta,
						title: "Alternative",
					},
				},
			}),
		);
		const branch = await Effect.runPromise(
			repository.createVersionFx({
				projectId: project.projectId,
				subject: "Alternative direction",
			}),
		);
		expect(branch.parentVersionId).toBe(root.versionId);
		expect(branch.sourceRevision).toBe(branchProject.revision);
		expect(
			(await Effect.runPromise(repository.listVersionsFx(project.projectId))).map(
				({ versionId }) => versionId,
			),
		).toEqual([branch.versionId, experiment.versionId, root.versionId]);

		const tagged = await Effect.runPromise(
			repository.updateVersionTagFx({
				projectId: project.projectId,
				tag: "interesting",
				versionId: branch.versionId,
			}),
		);
		expect(tagged.tag).toBe("interesting");
		expect(
			await Effect.runPromise(
				repository.updateVersionTagFx({
					projectId: project.projectId,
					versionId: branch.versionId,
				}),
			),
		).not.toHaveProperty("tag");

		const database = new DatabaseSync(harness.databasePath);
		expect(
			database.prepare("SELECT COUNT(*) AS count FROM project_version_blobs").get()?.count,
		).toBe(4);
		database.close();
	});

	it("rolls back the whole checkout when any restored part fails", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository);
		const root = await Effect.runPromise(
			repository.createVersionFx({ projectId: project.projectId, subject: "Root" }),
		);
		const changed = await Effect.runPromise(
			repository.upsertResourcesFx({
				projectId: project.projectId,
				resources: [
					{
						id: "hero",
						mime: "image/png",
						bytes: Uint8Array.of(9),
					},
				],
			}),
		);
		const before = await Effect.runPromise(repository.readVersionStatusFx(project.projectId));
		const database = new DatabaseSync(harness.databasePath);
		database.exec(`
			CREATE TRIGGER reject_restored_resource
			BEFORE INSERT ON resources
			BEGIN
				SELECT RAISE(ABORT, 'restored resource rejected');
			END;
		`);
		database.close();

		await expect(
			Effect.runPromise(
				repository.checkoutVersionFx({
					projectId: project.projectId,
					versionId: root.versionId,
				}),
			),
		).rejects.toThrow("could not be checked out");
		expect(await Effect.runPromise(repository.readProjectFx(project.projectId))).toEqual(changed);
		expect(await Effect.runPromise(repository.readVersionStatusFx(project.projectId))).toEqual(before);
	});

	it("keeps incompatible history visible but blocks mutation and checkout", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository);
		const version = await Effect.runPromise(
			repository.createVersionFx({ projectId: project.projectId, subject: "Old app" }),
		);
		const database = new DatabaseSync(harness.databasePath);
		database
			.prepare(
				"UPDATE project_versions SET arkini = ?, content_fingerprint = ? WHERE version_id = ?",
			)
			.run("0.1.0", "old-app-fingerprint", version.versionId);
		database.close();

		const [incompatible] = await Effect.runPromise(
			repository.listVersionsFx(project.projectId),
		);
		expect(incompatible?.applicability).toMatchObject({
			type: "incompatible",
		});
		await expect(
			Effect.runPromise(
				repository.checkoutVersionFx({
					projectId: project.projectId,
					versionId: version.versionId,
				}),
			),
		).rejects.toThrow("no compatible snapshot migrator");
		await expect(
			Effect.runPromise(
				repository.updateVersionTagFx({
					projectId: project.projectId,
					tag: "blocked",
					versionId: version.versionId,
				}),
			),
		).rejects.toThrow("no compatible snapshot migrator");
		await expect(
			Effect.runPromise(
				repository.diffVersionsFx({
					projectId: project.projectId,
					from: { type: "version", versionId: version.versionId },
					to: { type: "current" },
				}),
			),
		).rejects.toThrow("no compatible snapshot migrator");

		const checkpoint = await Effect.runPromise(
			repository.createVersionFx({
				projectId: project.projectId,
				subject: "Current app checkpoint",
			}),
		);
		expect(checkpoint).toMatchObject({
			arkini: ArkiniAppVersion,
			parentVersionId: version.versionId,
		});
	});
});
