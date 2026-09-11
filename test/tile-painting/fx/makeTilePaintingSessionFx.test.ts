import { Deferred, Effect } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it } from "vitest";
import { makeTilePaintingSessionFx } from "~/tile-painting/fx/makeTilePaintingSessionFx";
import type { TilePaintingSchema } from "~/tile-painting/schema/TilePaintingSchema";
import type { Project } from "~/project-authoring/type/Project";
import {
	ProjectRepository,
	type ProjectRepositoryService,
} from "~/project-authoring/service/ProjectRepository";

const loaded: TilePaintingSchema.Type = {
	projectId: "project",
	paintingId: "painting",
	updatedAtMs: 1,
	outputResourceId: null,
	document: {
		name: "Ground",
		images: [
			{
				id: "texture",
				sourceResourceId: "source",
				label: "Source",
			},
		],
		layers: [
			{
				id: "layer",
				imageId: "texture",
				name: "Ground",
				opacity: 1,
				visible: true,
				tileSize: 64,
				strokes: [],
			},
		],
		catalog: [],
		scatter: [],
		reference: null,
		preview: {
			columns: 1,
			rows: 1,
			cells: [
				{
					kind: "painting",
				},
			],
		},
	},
};
const project = {
	projectId: "project",
	revision: 10,
	resources: [],
} as unknown as Project;

const appendStrokeFn = (session: makeTilePaintingSessionFx.Output, x: number) => {
	const document = session.readFn().document;
	Effect.runSync(
		session.editFx({
			...document,
			layers: document.layers.map((layer) => ({
				...layer,
				strokes: [
					...layer.strokes,
					{
						mode: "reveal",
						size: 8,
						opacity: 1,
						hardness: 1,
						shape: "circle",
						brushImageId: null,
						points: [
							{
								x,
								y: 10,
							},
						],
					},
				],
			})),
		}),
	);
};

describe("imperative painting session transactions", () => {
	it("commits consecutive gestures synchronously without a React render or observer", () => {
		const session = Effect.runSync(
			makeTilePaintingSessionFx({
				loaded,
				project,
			}),
		);
		for (let index = 0; index < 20; index++) appendStrokeFn(session, index);
		expect(
			session.readFn().document.layers[0].strokes.map((stroke) => stroke.points[0].x),
		).toEqual(
			Array.from(
				{
					length: 20,
				},
				(_, index) => index,
			),
		);
		for (let index = 20; index > 0; index--) {
			Effect.runSync(session.undoFx);
			expect(session.readFn().document.layers[0].strokes).toHaveLength(index - 1);
		}
		for (let index = 0; index < 20; index++) Effect.runSync(session.redoFx);
		expect(session.readFn().document.layers[0].strokes).toHaveLength(20);
	});

	it("publishes admission synchronously and prevents edits or duplicate saves while persistence is pending", async () => {
		const session = Effect.runSync(
			makeTilePaintingSessionFx({
				loaded,
				project,
			}),
		);
		appendStrokeFn(session, 10);
		const document = session.readFn().document;
		const gate = Effect.runSync(Deferred.make<ProjectRepository.SaveTilePaintingResult>());
		let writes = 0;
		const repository = {
			saveTilePaintingFx: () =>
				Effect.gen(function* () {
					writes++;
					return yield* Deferred.await(gate);
				}),
		} as unknown as ProjectRepositoryService;
		const registry = AtomRegistry.make();
		const runSaveFn = () =>
			Effect.runPromise(
				session
					.saveFx()
					.pipe(
						Effect.provideService(ProjectRepository, repository),
						Effect.provideService(AtomRegistry.AtomRegistry, registry),
					),
			);
		try {
			const saving = runSaveFn();
			expect(session.readFn().busy).toBe(true);
			appendStrokeFn(session, 20);
			Effect.runSync(session.undoFx);
			expect(session.readFn().document).toBe(document);
			expect(await runSaveFn()).toBe(false);
			expect(writes).toBe(1);
			Effect.runSync(
				Deferred.succeed(gate, {
					project: {
						...project,
						revision: 11,
					},
					painting: {
						...loaded,
						updatedAtMs: 2,
						document,
					},
				}),
			);
			expect(await saving).toBe(true);
			expect(session.readFn().busy).toBe(false);
			expect(session.readFn().dirty).toBe(false);
		} finally {
			registry.dispose();
		}
	});

	it("does not apply a late save result or its cleanup to a reactivated session", async () => {
		const session = Effect.runSync(
			makeTilePaintingSessionFx({
				loaded,
				project,
			}),
		);
		appendStrokeFn(session, 10);
		const before = session.readFn().document;
		const firstGate = Effect.runSync(Deferred.make<ProjectRepository.SaveTilePaintingResult>());
		const secondGate = Effect.runSync(
			Deferred.make<ProjectRepository.SaveTilePaintingResult>(),
		);
		let writes = 0;
		const repository = {
			saveTilePaintingFx: () => Deferred.await(++writes === 1 ? firstGate : secondGate),
		} as unknown as ProjectRepositoryService;
		const registry = AtomRegistry.make();
		const runSaveFn = () =>
			Effect.runPromise(
				session
					.saveFx()
					.pipe(
						Effect.provideService(ProjectRepository, repository),
						Effect.provideService(AtomRegistry.AtomRegistry, registry),
					),
			);
		try {
			const first = runSaveFn();
			Effect.runSync(session.closeFx);
			Effect.runSync(session.activateFx);
			appendStrokeFn(session, 20);
			const after = session.readFn().document;
			const second = runSaveFn();
			Effect.runSync(
				Deferred.succeed(firstGate, {
					project: {
						...project,
						revision: 11,
					},
					painting: {
						...loaded,
						updatedAtMs: 2,
						document: before,
					},
				}),
			);
			expect(await first).toBe(false);
			expect(session.readFn().document).toBe(after);
			expect(session.readFn().busy).toBe(true);
			Effect.runSync(
				Deferred.succeed(secondGate, {
					project: {
						...project,
						revision: 12,
					},
					painting: {
						...loaded,
						updatedAtMs: 3,
						document: after,
					},
				}),
			);
			expect(await second).toBe(true);
			expect(session.readFn().document).toBe(after);
			expect(session.readFn().dirty).toBe(false);
		} finally {
			registry.dispose();
		}
	});
	it("releases busy admission when its caller interrupts a pending save", async () => {
		const session = Effect.runSync(
			makeTilePaintingSessionFx({
				loaded,
				project,
			}),
		);
		appendStrokeFn(session, 10);
		const document = session.readFn().document;
		const gate = Effect.runSync(Deferred.make<ProjectRepository.SaveTilePaintingResult>());
		const repository = {
			saveTilePaintingFx: () => Deferred.await(gate),
		} as unknown as ProjectRepositoryService;
		const registry = AtomRegistry.make();
		const controller = new AbortController();
		try {
			const saving = Effect.runPromise(
				session
					.saveFx()
					.pipe(
						Effect.provideService(ProjectRepository, repository),
						Effect.provideService(AtomRegistry.AtomRegistry, registry),
					),
				{
					signal: controller.signal,
				},
			);
			expect(session.readFn().busy).toBe(true);
			controller.abort();
			await saving.catch(() => false);
			expect(session.readFn().busy).toBe(false);
			expect(session.readFn().document).toBe(document);
			expect(session.readFn().dirty).toBe(true);
			appendStrokeFn(session, 20);
			expect(session.readFn().document.layers[0].strokes).toHaveLength(2);
		} finally {
			registry.dispose();
		}
	});
});
