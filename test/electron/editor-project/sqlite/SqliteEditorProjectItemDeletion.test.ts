import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	createSqliteEditorProjectTestHarness,
	type SqliteEditorProjectTestHarness,
} from "./support/createSqliteEditorProjectTestHarness";

let harness: SqliteEditorProjectTestHarness;

beforeEach(
	async () => (harness = await createSqliteEditorProjectTestHarness("arkini-item-delete-")),
);
afterEach(async () => harness.close());

describe("SQLite editor item deletion", () => {
	it("rejects a referenced item without changing canonical state", async () => {
		const repository = await harness.openRepository();
		const created = await harness.createProject(repository);

		await expect(
			Effect.runPromise(
				repository.deleteItemFx({
					expectedRevision: created.revision,
					force: false,
					itemUid: "water",
					projectId: created.projectId,
				}),
			),
		).rejects.toThrow("still referenced in 1 place");

		const canonical = await Effect.runPromise(repository.readProjectFx(created.projectId));
		expect(canonical?.revision).toBe(created.revision);
		expect(canonical?.config.items.water).toBeDefined();
	});

	it("rechecks revision and deletes only the eligible item, not its asset", async () => {
		const repository = await harness.openRepository();
		const created = await harness.createProject(repository);
		const eligible = await Effect.runPromise(
			repository.replaceConfigFx({
				projectId: created.projectId,
				expectedRevision: created.revision,
				config: {
					...created.config,
					start: {
						...created.config.start,
						board: [],
					},
				},
			}),
		);

		await expect(
			Effect.runPromise(
				repository.deleteItemFx({
					expectedRevision: created.revision,
					force: false,
					itemUid: "water",
					projectId: created.projectId,
				}),
			),
		).rejects.toThrow(`changed from revision ${created.revision} to ${eligible.revision}`);

		const deleted = await Effect.runPromise(
			repository.deleteItemFx({
				expectedRevision: eligible.revision,
				force: false,
				itemUid: "water",
				projectId: created.projectId,
			}),
		);
		const canonical = await Effect.runPromise(repository.readProjectFx(created.projectId));

		expect(deleted.revision).toBe(eligible.revision + 1);
		expect(canonical?.config.items.water).toBeUndefined();
		expect(canonical?.resources.find(({ id }) => id === "item-water")?.bytes).toEqual(
			Uint8Array.of(3, 4),
		);
	});

	it("force deletes a referenced item and its direct structures, but not its asset", async () => {
		const repository = await harness.openRepository();
		const created = await harness.createProject(repository);
		await Effect.runPromise(
			repository.writeBoardScenarioFx({
				projectId: created.projectId,
				expectedRevision: created.revision,
				name: "Before item deletion",
				bytes: Uint8Array.of(1),
			}),
		);

		const deleted = await Effect.runPromise(
			repository.deleteItemFx({
				expectedRevision: created.revision,
				force: true,
				itemUid: "water",
				projectId: created.projectId,
			}),
		);
		const canonical = await Effect.runPromise(repository.readProjectFx(created.projectId));

		expect(deleted).toMatchObject({
			revision: created.revision + 1,
			version: "2.0",
		});
		expect(canonical?.config.items.water).toBeUndefined();
		expect(canonical?.config.start.board).toEqual([]);
		expect(await Effect.runPromise(repository.listBoardScenariosFx(created.projectId))).toEqual(
			[],
		);
		expect(canonical?.resources.find(({ id }) => id === "item-water")?.bytes).toEqual(
			Uint8Array.of(3, 4),
		);
	});
});
