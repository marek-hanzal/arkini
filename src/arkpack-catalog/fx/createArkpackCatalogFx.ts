import { Cause, Effect, Exit, Option, Semaphore, SubscriptionRef } from "effect";
import type { ArkpackCatalog } from "~/arkpack-catalog/service/ArkpackCatalog";
import { importArkpackFileFx } from "~/arkpack-catalog/fx/importArkpackFileFx";
import { listArkpacksFx } from "~/arkpack-catalog/fx/listArkpacksFx";
import { createElectronArkpackStorageFx } from "~/arkpack-catalog/fx/createElectronArkpackStorageFx";

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
				props.importFileFx ?? (() => importArkpackFileFx()),
			);
			const installEditorBuildDependencyFx = Effect.fn(
				"ArkpackCatalog.installEditorBuildDependencyFx",
			)(
				props.installFx ??
					((request: {
						readonly packageId: string;
						readonly expectedRevision: number;
						readonly contentHash: string;
					}) =>
						createElectronArkpackStorageFx().pipe(
							Effect.flatMap((storage) =>
								storage.installEditorBuildFx === undefined
									? Effect.fail(
											new Error("Editor Build installation is unavailable."),
										)
									: storage.installEditorBuildFx(request),
							),
						)),
			);
			const removeDependencyFx = Effect.fn("ArkpackCatalog.removeDependencyFx")(
				props.removeFx ??
					((packageId: string) =>
						createElectronArkpackStorageFx().pipe(
							Effect.flatMap((storage) => storage.removeFx(packageId)),
						)),
			);
			const publishStateFx = Effect.fn("ArkpackCatalog.publishStateFx")(
				(next: ArkpackCatalog.State) =>
					SubscriptionRef.modifySome(
						state,
						(current) =>
							[
								undefined,
								current === next ||
								(current.type === "loading" && next.type === "loading")
									? Option.none()
									: Option.some(next),
							] as const,
					),
			);
			const recoverCatalogFx = Effect.fn("ArkpackCatalog.recoverCatalogFx")((cause) =>
				Effect.gen(function* () {
					yield* publishStateFx({
						type: "failed",
						error: Cause.squash(cause),
					});
					const recovery = yield* Effect.exit(listFx);
					if (Exit.isFailure(recovery)) return false;
					yield* publishStateFx({
						type: "ready",
						arkpacks: recovery.value,
					});
					return true;
				}),
			);
			const runCatalogOperationFx = <Result>(
				operationFx: Effect.Effect<Result, unknown, never>,
				admissionFx: Effect.Effect<void, unknown, never> = Effect.void,
				publishLoading = true,
			) =>
				lock.withPermits(1)(
					admissionFx.pipe(
						Effect.andThen(
							Effect.gen(function* () {
								if (publishLoading)
									yield* publishStateFx({
										type: "loading",
									});
								const operation = yield* Effect.exit(operationFx);
								if (Exit.isFailure(operation)) {
									yield* recoverCatalogFx(operation.cause);
									return yield* Effect.failCause(operation.cause);
								}
								const catalog = yield* Effect.exit(listFx);
								if (Exit.isFailure(catalog)) {
									if (yield* recoverCatalogFx(catalog.cause))
										return operation.value;
									return yield* Effect.failCause(catalog.cause);
								}
								yield* publishStateFx({
									type: "ready",
									arkpacks: catalog.value,
								});
								return operation.value;
							}).pipe(Effect.uninterruptible),
						),
					),
				);
			const admitInstallFx = Effect.fn("ArkpackCatalog.admitInstallFx")(
				({
					expectedCurrent,
					packageId,
				}: {
					readonly expectedCurrent: ArkpackCatalog.PackageSnapshot | null;
					readonly packageId: string;
				}) =>
					SubscriptionRef.get(state).pipe(
						Effect.flatMap((current) => {
							if (current.type !== "ready") {
								return Effect.fail(new Error("Arkpack catalog is not ready."));
							}
							const installed = current.arkpacks.find(
								(arkpack) => arkpack.packageId === packageId,
							);
							const unchanged =
								expectedCurrent === null
									? installed === undefined
									: installed !== undefined &&
										installed.packageId === expectedCurrent.packageId &&
										installed.contentHash === expectedCurrent.contentHash &&
										installed.version === expectedCurrent.version;
							return unchanged
								? Effect.void
								: Effect.fail(
										new Error(
											"The installed Arkpack changed before this action could start. Try again.",
										),
									);
						}),
					),
			);

			return {
				awaitIdleFx: lock.withPermits(1)(Effect.void),
				state,
				refreshFx: runCatalogOperationFx(Effect.void, Effect.void, false),
				importFileFx: Effect.fn("ArkpackCatalog.importFileFx")(() =>
					runCatalogOperationFx(importFileDependencyFx()),
				),
				installFx: Effect.fn("ArkpackCatalog.installFx")((install) =>
					runCatalogOperationFx(
						installEditorBuildDependencyFx({
							packageId: install.packageId,
							expectedRevision: install.expectedRevision,
							contentHash: install.contentHash,
						}),
						admitInstallFx({
							expectedCurrent: install.expectedCurrent,
							packageId: install.packageId,
						}),
					),
				),
				removeFx: Effect.fn("ArkpackCatalog.removeFx")((packageId: string) =>
					runCatalogOperationFx(removeDependencyFx(packageId)),
				),
			} satisfies ArkpackCatalog;
		}),
);
