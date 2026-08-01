import { Cause, Effect, Option, Semaphore, SubscriptionRef } from "effect";
import type { ArkpackCatalog } from "~/bridge/arkpack/ArkpackCatalog";
import { importArkpackFileFx } from "~/bridge/arkpack/importArkpackFileFx";
import { importArkpackFx } from "~/bridge/arkpack/importArkpackFx";
import { listArkpacksFx } from "~/bridge/arkpack/listArkpacksFx";
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
			const installDependencyFx = Effect.fn("ArkpackCatalog.installDependencyFx")(
				props.installFx ??
					(({ bytes, filename }) =>
						importArkpackFx({
							bytes,
							filename,
						})),
			);
			const removeDependencyFx = Effect.fn("ArkpackCatalog.removeDependencyFx")(
				props.removeFx ??
					((packageId: string) =>
						removeArkpackFx({
							packageId,
						})),
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
			const runCatalogOperationFx = <Result>(operationFx: Effect.Effect<Result, unknown>) =>
				lock.withPermits(1)(
					Effect.gen(function* () {
						yield* publishStateFx({
							type: "loading",
						});
						const result = yield* operationFx;
						const arkpacks = yield* listFx;
						yield* publishStateFx({
							type: "ready",
							arkpacks,
						});
						return result;
					}).pipe(
						Effect.tapCause((cause) =>
							publishStateFx({
								type: "failed",
								error: Cause.squash(cause),
							}),
						),
						Effect.uninterruptible,
					),
				);

			return {
				awaitIdleFx: lock.withPermits(1)(Effect.void),
				state,
				refreshFx: runCatalogOperationFx(Effect.void),
				importFileFx: Effect.fn("ArkpackCatalog.importFileFx")((file: File) =>
					runCatalogOperationFx(importFileDependencyFx(file)),
				),
				installFx: Effect.fn("ArkpackCatalog.installFx")((install) =>
					runCatalogOperationFx(installDependencyFx(install)),
				),
				removeFx: Effect.fn("ArkpackCatalog.removeFx")((packageId: string) =>
					runCatalogOperationFx(removeDependencyFx(packageId)),
				),
			} satisfies ArkpackCatalog;
		}),
);
