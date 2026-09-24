import { Effect } from "effect";
import { afterEach, beforeEach, expect, it } from "vitest";
import { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { OutcomeTableSchema } from "~/outcome/schema/OutcomeTableSchema";
import { createLine } from "~test/game-config-validation/support/gameValidationTestSource";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";
import {
	createProjectTestHarness,
	type ProjectTestHarness,
} from "./support/createProjectTestHarness";

let harness: ProjectTestHarness;
beforeEach(async () => {
	harness = await createProjectTestHarness("serakki-template-refs-");
});
afterEach(async () => harness.close());

const outcomeFn = (templateUid: string, generated = false) =>
	OutcomeTableSchema.parse({
		set: [
			{
				rules: [],
				roll: [
					{
						type: "guaranteed",
						outcome: [
							generated
								? {
										type: "space",
										space: {
											type: "generated",
											templateUid,
										},
										rules: [],
									}
								: {
										type: "template",
										templateUid,
										rules: [],
									},
						],
					},
				],
			},
		],
	});

it.each([
	false,
	true,
])(
	"rejects missing Template references from every item outcome owner before either write path publishes (generated=%s)",
	async (generated) => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository);
		const outcome = outcomeFn("missing-template", generated);
		const patches = [
			{
				merge: [
					{
						action: "space",
						effect: "keep",
						space: {
							type: "generated",
							templateUid: "missing-template",
						},
					},
				],
			},
			{
				lines: [
					createLine({
						outcome,
					}),
				],
			},
			{
				units: {
					amount: 1,
					outcome,
				},
			},
			{
				clock: {
					durationMs: 1000,
					onExpire: outcome,
				},
			},
			{
				merge: [
					{
						action: "use",
						target: {
							type: "item",
							itemUid: "water",
						},
						effect: "keep",
						outcome,
					},
				],
			},
		];
		for (const patch of patches) {
			const item = ItemSchema.parse({
				...project.config.items.water,
				...patch,
			});
			await expect(
				Effect.runPromise(
					repository.upsertItemFx({
						projectId: project.projectId,
						expectedRevision: project.revision,
						item,
					}),
				),
			).rejects.toThrow("template missing-template does not exist");
			await expect(
				Effect.runPromise(
					repository.replaceConfigFx({
						projectId: project.projectId,
						expectedRevision: project.revision,
						config: {
							...project.config,
							items: {
								...project.config.items,
								water: item,
							},
						},
					}),
				),
			).rejects.toThrow("template missing-template does not exist");
		}
		expect(await Effect.runPromise(repository.readProjectFx(project.projectId))).toEqual(
			project,
		);
		await harness.closeRepository(repository);
		const reopened = await harness.openRepository();
		expect(await Effect.runPromise(reopened.readProjectFx(project.projectId))).toEqual(project);
	},
);

it.each([
	false,
	true,
])(
	"allows unrelated unfinished items, but blocks removing a referenced Template until its outcome is repaired (generated=%s)",
	async (generated) => {
		const repository = await harness.openRepository();
		const broken = ItemSchema.parse({
			...editorTestPayload.config.items.water,
			uid: "unfinished",
			units: {
				amount: 1,
				outcome: outcomeFn("not-authored-yet"),
			},
		});
		const project = await Effect.runPromise(
			repository.createProjectFx({
				version: {
					major: 1,
					minor: 0,
				},
				resources: editorTestPayload.resources,
				config: {
					...editorTestPayload.config,
					items: {
						...editorTestPayload.config.items,
						unfinished: broken,
					},
				},
			}),
		);
		const saved = await Effect.runPromise(
			repository.upsertItemFx({
				projectId: project.projectId,
				expectedRevision: project.revision,
				item: {
					...project.config.items.water!,
					units: {
						amount: 1,
						outcome: outcomeFn("initial", generated),
					},
				},
			}),
		);
		await expect(
			Effect.runPromise(
				repository.replaceConfigFx({
					projectId: project.projectId,
					expectedRevision: saved.revision,
					config: {
						...saved.config,
						templates: [],
						start: {
							currentSpace: 0,
							spaces: [],
						},
					},
				}),
			),
		).rejects.toThrow("template initial does not exist");
		expect(
			(await Effect.runPromise(repository.readProjectFx(project.projectId)))?.revision,
		).toBe(saved.revision);
		const repaired = await Effect.runPromise(
			repository.replaceConfigFx({
				projectId: project.projectId,
				expectedRevision: saved.revision,
				config: {
					...saved.config,
					templates: [],
					start: {
						currentSpace: 0,
						spaces: [],
					},
					items: {
						...saved.config.items,
						water: project.config.items.water!,
					},
				},
			}),
		);
		expect(repaired.config.templates).toEqual([]);
		expect(repaired.config.items.unfinished).toEqual(broken);
	},
);
