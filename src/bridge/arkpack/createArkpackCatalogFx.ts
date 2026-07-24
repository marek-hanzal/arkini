import { Cause, Effect } from "effect";
import type { ArkpackCatalog } from "~/bridge/arkpack/ArkpackCatalog";
import { importArkpackFileFx } from "~/bridge/arkpack/importArkpackFileFx";
import { listArkpacksFx } from "~/bridge/arkpack/listArkpacksFx";
import { removeArkpackFx } from "~/bridge/arkpack/removeArkpackFx";
import { invokeExternalCallbackFx } from "~/engine/common/fx/invokeExternalCallbackFx";

/** Creates one shared catalog owner over authoritative Arkpack storage operations. */
export const createArkpackCatalogFx = Effect.fn("createArkpackCatalogFx")(
	(props: ArkpackCatalog.Props = {}) =>
		Effect.gen(function* () {
			const listeners = new Set<() => void | PromiseLike<void>>();
			const lock = yield* Effect.makeSemaphore(1);
			let state: ArkpackCatalog.State = {
				type: "loading",
			};

			const publishStateFx = (next: ArkpackCatalog.State) =>
				Effect.gen(function* () {
					state = next;
					for (const listener of Array.from(listeners)) {
						yield* invokeExternalCallbackFx({
							callback: listener,
							failureMessage:
								"Arkini catalog observer failed; persistent catalog work remains active.",
							value: undefined,
						});
					}
				});

			const list = props.listFx ?? listArkpacksFx();
			const importFile =
				props.importFileFx ??
				((file: File) =>
					importArkpackFileFx({
						file,
					}));
			const remove =
				props.removeFx ??
				((packageId: string) =>
					removeArkpackFx({
						packageId,
					}));

			const refreshFx = lock.withPermits(1)(
				Effect.gen(function* () {
					yield* publishStateFx({
						type: "loading",
					});
					const arkpacks = yield* list;
					yield* publishStateFx({
						type: "ready",
						arkpacks,
					});
				}).pipe(
					Effect.tapError((error) =>
						publishStateFx({
							type: "failed",
							error: Cause.originalError(error),
						}),
					),
				),
			);

			return {
				getSnapshot: () => state,
				refreshFx,
				importFileFx: (file) =>
					lock.withPermits(1)(
						Effect.gen(function* () {
							yield* publishStateFx({
								type: "loading",
							});
							const imported = yield* importFile(file);
							const arkpacks = yield* list;
							yield* publishStateFx({
								type: "ready",
								arkpacks,
							});
							return imported;
						}).pipe(
							Effect.tapError((error) =>
								publishStateFx({
									type: "failed",
									error: Cause.originalError(error),
								}),
							),
						),
					),
				removeFx: (packageId) =>
					lock.withPermits(1)(
						Effect.gen(function* () {
							yield* publishStateFx({
								type: "loading",
							});
							const removed = yield* remove(packageId);
							const arkpacks = yield* list;
							yield* publishStateFx({
								type: "ready",
								arkpacks,
							});
							return removed;
						}).pipe(
							Effect.tapError((error) =>
								publishStateFx({
									type: "failed",
									error: Cause.originalError(error),
								}),
							),
						),
					),
				subscribe: (listener) => {
					listeners.add(listener);
					return () => listeners.delete(listener);
				},
			} satisfies ArkpackCatalog;
		}),
);
