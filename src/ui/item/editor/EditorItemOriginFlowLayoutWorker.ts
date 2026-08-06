import * as BrowserWorker from "@effect/platform-browser/BrowserWorker";
import { Data, Deferred, Effect, Fiber } from "effect";
import * as EffectWorker from "effect/unstable/workers/Worker";

import type { EditorItemOriginFlow } from "~/bridge/item/editor/readEditorItemOriginFlow";
import type {
	EditorItemOriginFlowLayoutInput,
	EditorItemOriginFlowLayoutNode,
} from "~/ui/item/editor/layoutEditorItemOriginFlow";

export interface EditorItemOriginFlowLayoutWorkerRequest {
	readonly generation: number;
	readonly topology: EditorItemOriginFlowLayoutInput;
}

export type EditorItemOriginFlowLayoutWorkerResponse =
	| {
			readonly generation: number;
			readonly positions: ReadonlyArray<
				readonly [
					string,
					EditorItemOriginFlowLayoutNode,
				]
			>;
			readonly type: "success";
	  }
	| {
			readonly generation: number;
			readonly message: string;
			readonly type: "error";
	  };

export class EditorItemOriginFlowLayoutWorkerError extends Data.TaggedError(
	"EditorItemOriginFlowLayoutWorkerError",
)<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export interface EditorItemOriginFlowLayoutWorkerOwner {
	/** Supersedes and physically terminates any layout that is still running. */
	readonly layoutFx: (
		flow: EditorItemOriginFlow,
	) => Effect.Effect<
		ReadonlyMap<string, EditorItemOriginFlowLayoutNode>,
		EditorItemOriginFlowLayoutWorkerError
	>;
}

const defaultSpawn = () =>
	new Worker(new URL("./editorItemOriginFlowLayout.worker.ts", import.meta.url), {
		type: "module",
	});

/** Owns the one current flow-layout worker and ties native termination to its Scope. */
export const makeEditorItemOriginFlowLayoutWorkerOwnerFx = Effect.fn(
	"makeEditorItemOriginFlowLayoutWorkerOwnerFx",
)(function* (options: { readonly spawn?: () => Worker } = {}) {
	const spawn = options.spawn ?? defaultSpawn;
	let generation = 0;
	let active:
		| {
				readonly superseded: Deferred.Deferred<void>;
				readonly worker: Worker;
		  }
		| undefined;

	yield* Effect.addFinalizer(() =>
		Effect.sync(() => {
			generation += 1;
			active?.worker.terminate();
			if (active !== undefined) Deferred.doneUnsafe(active.superseded, Effect.void);
			active = undefined;
		}),
	);

	const layoutFx: EditorItemOriginFlowLayoutWorkerOwner["layoutFx"] = Effect.fn(
		"EditorItemOriginFlowLayoutWorkerOwner.layoutFx",
	)(function* (flow) {
		const requestGeneration = ++generation;
		const superseded = yield* Deferred.make<void>();
		active?.worker.terminate();
		if (active !== undefined) Deferred.doneUnsafe(active.superseded, Effect.void);
		const nativeWorker = yield* Effect.try({
			try: spawn,
			catch: (cause) =>
				new EditorItemOriginFlowLayoutWorkerError({
					cause,
					message: "Could not start the flow layout worker.",
				}),
		});
		active = {
			superseded,
			worker: nativeWorker,
		};

		return yield* Effect.scoped(
			Effect.gen(function* () {
				yield* Effect.addFinalizer(() =>
					Effect.sync(() => {
						nativeWorker.terminate();
						if (active?.worker === nativeWorker) active = undefined;
					}),
				);

				const completed = yield* Deferred.make<EditorItemOriginFlowLayoutWorkerResponse>();
				const platform = yield* EffectWorker.WorkerPlatform;
				const worker = yield* platform.spawn<
					EditorItemOriginFlowLayoutWorkerResponse,
					EditorItemOriginFlowLayoutWorkerRequest
				>(requestGeneration);
				const listener = yield* Effect.forkScoped(
					worker.run((response) => Deferred.succeed(completed, response)),
				);
				yield* worker.send({
					generation: requestGeneration,
					topology: {
						edges: flow.edges.map(({ role, source, target }) => ({
							role,
							source,
							target,
						})),
						nodes: flow.nodes.map(({ id, kind, status }) => ({
							id,
							kind,
							starter: status === "starter",
						})),
					},
				});
				const response = yield* Effect.raceFirst(
					Effect.raceFirst(Deferred.await(completed), Fiber.join(listener)),
					Deferred.await(superseded).pipe(Effect.andThen(Effect.interrupt)),
				);
				if (response.generation !== generation) return yield* Effect.interrupt;
				if (response.type === "error") {
					return yield* new EditorItemOriginFlowLayoutWorkerError({
						message: response.message,
					});
				}
				return new Map(response.positions);
			}).pipe(
				Effect.provide(BrowserWorker.layer(() => nativeWorker)),
				Effect.mapError((cause) =>
					cause instanceof EditorItemOriginFlowLayoutWorkerError
						? cause
						: new EditorItemOriginFlowLayoutWorkerError({
								cause,
								message: "Flow layout worker communication failed.",
							}),
				),
			),
		);
	});

	return {
		layoutFx,
	} satisfies EditorItemOriginFlowLayoutWorkerOwner;
});
