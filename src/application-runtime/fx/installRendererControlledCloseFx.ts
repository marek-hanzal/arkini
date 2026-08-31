import { Effect, Exit, Option } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { ArkpackCatalogOwnerAtom } from "~/arkpack-catalog/atom/ArkpackCatalogOwnerAtom";
import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { EditorUnsavedChanges } from "~/authoring-session/service/EditorUnsavedChanges";
import { readExactCauseFailureFn } from "~/application-diagnostics/fn/readExactCauseFailureFn";
import { GameEngineResourceFx } from "~/installed-game/service/GameEngineResourceFx";
import type { RendererRuntime } from "~/application-runtime/service/RendererRuntime";

interface ExitRouter {
	readonly navigate: (options: {
		readonly params: {
			readonly packageId: string;
		};
		readonly replace: true;
		readonly to: "/game/$packageId/action/exit";
	}) => Promise<unknown>;
}

interface Props {
	readonly lifecycle: Pick<Window["arkini"]["lifecycle"], "onBeforeClose" | "onBeforeCloseReady">;
	readonly rendererRuntime: typeof RendererRuntime;
	readonly requestEditorLeaveFx?: Effect.Effect<boolean, never, EditorUnsavedChanges>;
	readonly router: ExitRouter;
}

const actionLoadingCompletionHoldMs = 150;

const waitForActionLoadingCompletionFrameFx = () =>
	Effect.promise(async () => {
		await new Promise<void>((resolve) => {
			window.requestAnimationFrame(() => resolve());
		});
		await new Promise<void>((resolve) => {
			window.requestAnimationFrame(() => resolve());
		});
		await new Promise<void>((resolve) => {
			window.setTimeout(resolve, actionLoadingCompletionHoldMs);
		});
	});

/**
 * Installs the renderer-owned half of the native close handshake.
 *
 * The first callback claims an active or provisional Game before route
 * interruption can orphan it, then delegates final save/disposal to the terminal
 * exit route. The second callback waits for that route's completed presentation
 * frame. This owner coordinates the handshake; it never saves or disposes a Game
 * itself.
 */
export const installRendererControlledCloseFx = Effect.fn("installRendererControlledCloseFx")(
	({
		lifecycle,
		requestEditorLeaveFx = Effect.flatMap(EditorUnsavedChanges, (owner) =>
			Effect.promise(() => owner.requestLeave()),
		),
		rendererRuntime,
		router,
	}: Props) =>
		Effect.sync(() => {
			let exitPresentationRequired = false;
			const awaitEditorOperations = async () => {
				await rendererRuntime.runPromise(
					Effect.flatMap(ProjectRepository, (repository) => repository.awaitIdleFx),
				);
				const catalog = await rendererRuntime.runPromise(Atom.get(ArkpackCatalogOwnerAtom));
				if (catalog !== undefined) await rendererRuntime.runPromise(catalog.awaitIdleFx);
			};

			const removeBeforeClose = lifecycle.onBeforeClose(async () => {
				exitPresentationRequired = false;
				const exit = await rendererRuntime.runPromiseExit(
					GameEngineResourceFx.pipe(Effect.flatMap((service) => service.claimForCloseFx)),
				);
				if (Exit.isFailure(exit)) {
					const failure = readExactCauseFailureFn(exit.cause);
					throw Option.isSome(failure) ? failure.value : exit.cause;
				}
				const resource = exit.value;
				if (resource === null) {
					if (!(await rendererRuntime.runPromise(requestEditorLeaveFx))) {
						throw new Error(
							"Native close was canceled because the editor has unsaved changes.",
						);
					}
					await awaitEditorOperations();
					return;
				}
				await awaitEditorOperations();
				exitPresentationRequired = true;
				// Route ownership keeps finalization identical for UI-requested and native close.
				await router.navigate({
					to: "/game/$packageId/action/exit",
					params: {
						packageId: resource.game.arkpack.packageId,
					},
					replace: true,
				});
			});
			const removeBeforeCloseReady = lifecycle.onBeforeCloseReady(async () => {
				if (!exitPresentationRequired) return;
				// Native close may continue only after the completed route has painted once.
				await rendererRuntime.runPromise(waitForActionLoadingCompletionFrameFx());
			});

			return () => {
				removeBeforeClose();
				removeBeforeCloseReady();
			};
		}),
);
