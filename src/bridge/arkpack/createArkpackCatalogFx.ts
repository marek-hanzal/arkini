import { Effect, Semaphore, SubscriptionRef } from "effect";
import type { ArkpackCatalog } from "~/bridge/arkpack/ArkpackCatalog";
import { importArkpackFileFx } from "~/bridge/arkpack/importArkpackFileFx";
import { listArkpacksFx } from "~/bridge/arkpack/listArkpacksFx";
import { publishArkpackCatalogStateFx } from "~/bridge/arkpack/publishArkpackCatalogStateFx";
import { removeArkpackFx } from "~/bridge/arkpack/removeArkpackFx";

/** Creates one shared catalog owner over authoritative Arkpack storage operations. */
export const createArkpackCatalogFx = Effect.fn("createArkpackCatalogFx")(
	(props: ArkpackCatalog.Props = {}) =>
		Effect.gen(function* () {
			const lock = yield* Semaphore.make(1);
			const state = yield* SubscriptionRef.make<ArkpackCatalog.State>({
				type: "loading",
			});

			const listFx = props.listFx ?? listArkpacksFx();
			const importFileDependencyFx = Effect.fn("ArkpackCatalog.importFileDependencyFx")(
				props.importFileFx ??
					((file: File) =>
						importArkpackFileFx({
							file,
						})),
			);
			const removeDependencyFx = Effect.fn("ArkpackCatalog.removeDependencyFx")(
				props.removeFx ??
					((packageId: string) =>
						removeArkpackFx({
							packageId,
						})),
			);

			const refreshFx = lock.withPermits(1)(
				Effect.gen(function* () {
					yield* publishArkpackCatalogStateFx({
						state,
						next: {
							type: "loading",
						},
					});
					const arkpacks = yield* listFx;
					yield* publishArkpackCatalogStateFx({
						state,
						next: {
							type: "ready",
							arkpacks,
						},
					});
				}).pipe(
					Effect.tapError((error) =>
						publishArkpackCatalogStateFx({
							state,
							next: {
								type: "failed",
								error,
							},
						}),
					),
					Effect.uninterruptible,
				),
			);

			return {
				state,
				refreshFx,
				importFileFx: Effect.fn("ArkpackCatalog.importFileFx")((file: File) =>
					lock.withPermits(1)(
						Effect.gen(function* () {
							yield* publishArkpackCatalogStateFx({
								state,
								next: {
									type: "loading",
								},
							});
							const imported = yield* importFileDependencyFx(file);
							const arkpacks = yield* listFx;
							yield* publishArkpackCatalogStateFx({
								state,
								next: {
									type: "ready",
									arkpacks,
								},
							});
							return imported;
						}).pipe(
							Effect.tapError((error) =>
								publishArkpackCatalogStateFx({
									state,
									next: {
										type: "failed",
										error,
									},
								}),
							),
							Effect.uninterruptible,
						),
					),
				),
				removeFx: Effect.fn("ArkpackCatalog.removeFx")((packageId: string) =>
					lock.withPermits(1)(
						Effect.gen(function* () {
							yield* publishArkpackCatalogStateFx({
								state,
								next: {
									type: "loading",
								},
							});
							const removed = yield* removeDependencyFx(packageId);
							const arkpacks = yield* listFx;
							yield* publishArkpackCatalogStateFx({
								state,
								next: {
									type: "ready",
									arkpacks,
								},
							});
							return removed;
						}).pipe(
							Effect.tapError((error) =>
								publishArkpackCatalogStateFx({
									state,
									next: {
										type: "failed",
										error,
									},
								}),
							),
							Effect.uninterruptible,
						),
					),
				),
			} satisfies ArkpackCatalog;
		}),
);
