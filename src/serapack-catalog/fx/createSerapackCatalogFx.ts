import { Cause, Effect, Exit, Option, Semaphore, SubscriptionRef } from "effect";
import type { SerapackCatalog } from "~/serapack-catalog/service/SerapackCatalog";
import { importSerapackFileFx } from "~/serapack-catalog/fx/importSerapackFileFx";
import { listSerapacksFx } from "~/serapack-catalog/fx/listSerapacksFx";
import { createElectronSerapackStorageFx } from "~/serapack-catalog/fx/createElectronSerapackStorageFx";

/** Creates one shared catalog owner over authoritative Serapack storage operations. */
export const createSerapackCatalogFx = Effect.fn("createSerapackCatalogFx")(
	(props: SerapackCatalog.Props = {}) =>
		Effect.gen(function* () {
			const lock = yield* Semaphore.make(1);
			const state = yield* SubscriptionRef.make<SerapackCatalog.State>({
				type: "loading",
			});

			const listFx = props.listFx ?? listSerapacksFx();
			const importFileDependencyFx = Effect.fn("SerapackCatalog.importFileDependencyFx")(
				props.importFileFx ?? (() => importSerapackFileFx()),
			);
			const installEditorBuildDependencyFx = Effect.fn(
				"SerapackCatalog.installEditorBuildDependencyFx",
			)(
				props.installFx ??
					((request: {
						readonly packageId: string;
						readonly expectedRevision: number;
						readonly contentHash: string;
					}) =>
						createElectronSerapackStorageFx().pipe(
							Effect.flatMap((storage) =>
								storage.installEditorBuildFx === undefined
									? Effect.fail(
											new Error("Editor Build installation is unavailable."),
										)
									: storage.installEditorBuildFx(request),
							),
						)),
			);
			const removeDependencyFx = Effect.fn("SerapackCatalog.removeDependencyFx")(
				props.removeFx ??
					((packageId: string) =>
						createElectronSerapackStorageFx().pipe(
							Effect.flatMap((storage) => storage.removeFx(packageId)),
						)),
			);
			const publishStateFx = Effect.fn("SerapackCatalog.publishStateFx")(
				(next: SerapackCatalog.State) =>
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
			const recoverCatalogFx = Effect.fn("SerapackCatalog.recoverCatalogFx")((cause) =>
				Effect.gen(function* () {
					yield* publishStateFx({
						type: "failed",
						error: Cause.squash(cause),
					});
					const recovery = yield* Effect.exit(listFx);
					if (Exit.isFailure(recovery)) return false;
					yield* publishStateFx({
						type: "ready",
						serapacks: recovery.value,
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
									serapacks: catalog.value,
								});
								return operation.value;
							}).pipe(Effect.uninterruptible),
						),
					),
				);
			const admitInstallFx = Effect.fn("SerapackCatalog.admitInstallFx")(
				({
					expectedCurrent,
					packageId,
				}: {
					readonly expectedCurrent: SerapackCatalog.PackageSnapshot | null;
					readonly packageId: string;
				}) =>
					SubscriptionRef.get(state).pipe(
						Effect.flatMap((current) => {
							if (current.type !== "ready") {
								return Effect.fail(new Error("Serapack catalog is not ready."));
							}
							const installed = current.serapacks.find(
								(serapack) => serapack.packageId === packageId,
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
											"The installed Serapack changed before this action could start. Try again.",
										),
									);
						}),
					),
			);

			return {
				awaitIdleFx: lock.withPermits(1)(Effect.void),
				state,
				refreshFx: runCatalogOperationFx(Effect.void, Effect.void, false),
				importFileFx: Effect.fn("SerapackCatalog.importFileFx")(() =>
					runCatalogOperationFx(importFileDependencyFx()),
				),
				installFx: Effect.fn("SerapackCatalog.installFx")((install) =>
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
				removeFx: Effect.fn("SerapackCatalog.removeFx")((packageId: string) =>
					runCatalogOperationFx(removeDependencyFx(packageId)),
				),
			} satisfies SerapackCatalog;
		}),
);
