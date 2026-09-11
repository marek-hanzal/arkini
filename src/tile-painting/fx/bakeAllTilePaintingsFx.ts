import { Effect, Encoding, Result } from "effect";
import { publishEditorProjectFx } from "~/authoring-session/fx/publishEditorProjectFx";
import type { ResourceSchema } from "~/game-config-resource/schema/ResourceSchema";
import { ProjectOperationError } from "~/project-authoring/error/ProjectOperationError";
import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import type { Project } from "~/project-authoring/type/Project";
import { planTilePaintingBakeFn } from "~/tile-painting/fn/planTilePaintingBakeFn";
import { prepareTilePaintingBakeFx } from "~/tile-painting/fx/prepareTilePaintingBakeFx";
import type { TilePaintingSchema } from "~/tile-painting/schema/TilePaintingSchema";

export namespace bakeAllTilePaintingsFx {
	export interface Props {
		readonly projectId: string;
		readonly onProgressFn?: (completed: number, total: number) => void;
	}
	export interface Output {
		readonly project: Project;
		readonly paintings: ReadonlyArray<TilePaintingSchema.Type>;
		readonly bakedCount: number;
		readonly skippedCount: number;
	}
}

/** Plan and render the whole dependency chain before one repository journal can publish any output. */
export const bakeAllTilePaintingsFx = Effect.fn("bakeAllTilePaintingsFx")(function* ({
	projectId,
	onProgressFn,
}: bakeAllTilePaintingsFx.Props) {
	const repository = yield* ProjectRepository;
	const project = yield* repository.readProjectFx(projectId);
	if (project === null)
		return yield* Effect.fail(
			new ProjectOperationError({
				reason: "project-not-found",
				message: "The painting project no longer exists.",
			}),
		);
	const paintings = yield* repository.listTilePaintingsFx(projectId);
	const plan = planTilePaintingBakeFn({
		paintings,
		resourceIds: project.resources.map((resource) => resource.id),
	});
	if (plan.type === "invalid")
		return yield* Effect.fail(
			new ProjectOperationError({
				reason: "invalid-asset",
				message: plan.message,
			}),
		);
	if (plan.steps.length === 0)
		return {
			project,
			paintings: [],
			bakedCount: 0,
			skippedCount: plan.skippedCount,
		} satisfies bakeAllTilePaintingsFx.Output;
	const resources = new Map<string, ResourceSchema.Type>(
		project.resources.map((resource) => [
			resource.id,
			resource,
		]),
	);
	const records = new Map(
		paintings.map((painting) => [
			painting.paintingId,
			painting,
		]),
	);
	const deferredResourceIds = new Set(plan.steps.map((step) => step.outputResourceId));
	const prepared: Array<ProjectRepository.BakeTilePaintingsProps["paintings"][number]> = [];
	yield* Effect.sync(() => onProgressFn?.(0, plan.steps.length));
	for (const step of plan.steps) {
		const painting = records.get(step.paintingId)!;
		const result = yield* prepareTilePaintingBakeFx({
			document: painting.document,
			resources: [
				...resources.values(),
			],
			outputResourceId: step.outputResourceId,
			deferredResourceIds,
		});
		const decoded = Encoding.decodeBase64(
			result.bakedPng.slice("data:image/png;base64,".length),
		);
		if (Result.isFailure(decoded))
			return yield* Effect.die(new Error("The canvas returned an invalid PNG encoding."));
		resources.set(step.outputResourceId, {
			id: step.outputResourceId,
			mime: "image/png",
			bytes: decoded.success,
		});
		prepared.push({
			paintingId: painting.paintingId,
			expectedUpdatedAtMs: painting.updatedAtMs,
			document: result.document,
			bakedPng: result.bakedPng,
		});
		yield* Effect.sync(() => onProgressFn?.(prepared.length, plan.steps.length));
	}

	const result = yield* repository.bakeTilePaintingsFx({
		projectId,
		expectedRevision: project.revision,
		paintings: prepared,
	});
	yield* publishEditorProjectFx(projectId, {
		project: result.project,
	});
	return {
		...result,
		bakedCount: prepared.length,
		skippedCount: plan.skippedCount,
	} satisfies bakeAllTilePaintingsFx.Output;
});
