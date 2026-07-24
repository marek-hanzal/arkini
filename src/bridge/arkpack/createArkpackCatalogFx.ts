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

			const publishArkpackCatalogStateFx = Effect.fn("publishArkpackCatalogStateFx")(
				function* (next: ArkpackCatalog.State) {
					state = next;
					for (const listener of Array.from(listeners)) {
						yield* invokeExternalCallbackFx({
							callback: listener,
							failureMessage:
								"Arkini catalog observer failed; persistent catalog work remains active.",
							value: undefined,
						});
					}
				},
			);

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

			const refreshArkpackCatalogFx = Effect.fn("refreshArkpackCatalogFx")(() =>
				Effect.gen(function* () {
					yield* publishArkpackCatalogStateFx({
						type: "loading",
					});
					const arkpacks = yield* list;
					yield* publishArkpackCatalogStateFx({
						type: "ready",
						arkpacks,
					});
				}).pipe(
					Effect.tapError((error) =>
						publishArkpackCatalogStateFx({
							type: "failed",
							error: Cause.originalError(error),
						}),
					),
				),
			);
			const refreshFx = lock.withPermits(1)(refreshArkpackCatalogFx());

			const mutateAndRefreshFx = Effect.fn("mutateAndRefreshFx")(function* <Value>(
				operation: Effect.Effect<Value, unknown>,
			) {
				return yield* lock.withPermits(1)(
					Effect.gen(function* () {
						yield* publishArkpackCatalogStateFx({
							type: "loading",
						});
						const value = yield* operation;
						const arkpacks = yield* list;
						yield* publishArkpackCatalogStateFx({
							type: "ready",
							arkpacks,
						});
						return value;
					}).pipe(
						Effect.tapError((error) =>
							publishArkpackCatalogStateFx({
								type: "failed",
								error: Cause.originalError(error),
							}),
						),
					),
				);
			});

			return {
				getSnapshot: () => state,
				refreshFx,
				importFileFx: (file) => mutateAndRefreshFx(importFile(file)),
				removeFx: (packageId) => mutateAndRefreshFx(remove(packageId)),
				subscribe: (listener) => {
					listeners.add(listener);
					return () => listeners.delete(listener);
				},
			} satisfies ArkpackCatalog;
		}),
);
