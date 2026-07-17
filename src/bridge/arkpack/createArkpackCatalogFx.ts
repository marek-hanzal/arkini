import { Effect } from "effect";
import type { ArkpackCatalog } from "~/bridge/arkpack/ArkpackCatalog";
import { importArkpackFileFx } from "~/bridge/arkpack/importArkpackFileFx";
import { listArkpacksFx } from "~/bridge/arkpack/listArkpacksFx";
import { removeArkpackFx } from "~/bridge/arkpack/removeArkpackFx";

/** Creates one shared catalog owner over authoritative Arkpack storage operations. */
export const createArkpackCatalogFx = Effect.fn("createArkpackCatalogFx")(
	(props: ArkpackCatalog.Props = {}) =>
		Effect.gen(function* () {
			const listeners = new Set<() => void | PromiseLike<void>>();
			const lock = yield* Effect.makeSemaphore(1);
			let state: ArkpackCatalog.State = {
				type: "loading",
			};

			const publish = (next: ArkpackCatalog.State) => {
				state = next;
				for (const listener of Array.from(listeners)) {
					try {
						const result = listener();
						if (result !== undefined)
							void Promise.resolve(result).catch(() => undefined);
					} catch {
						// Catalog observers cannot stop persistent catalog work.
					}
				}
			};

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
					publish({
						type: "loading",
					});
					const arkpacks = yield* list;
					publish({
						type: "ready",
						arkpacks,
					});
				}).pipe(
					Effect.tapError((error) =>
						Effect.sync(() =>
							publish({
								type: "failed",
								error,
							}),
						),
					),
				),
			);

			const mutateAndRefreshFx = <Value>(
				operation: Effect.Effect<Value, unknown>,
			): Effect.Effect<Value, unknown> =>
				lock.withPermits(1)(
					Effect.gen(function* () {
						const value = yield* operation;
						publish({
							type: "loading",
						});
						const arkpacks = yield* list;
						publish({
							type: "ready",
							arkpacks,
						});
						return value;
					}).pipe(
						Effect.tapError((error) =>
							Effect.sync(() =>
								publish({
									type: "failed",
									error,
								}),
							),
						),
					),
				);

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
