import { Effect, Exit, Fiber, ManagedRuntime, Scope } from "effect";

import { afterEach } from "vitest";

import type { Game } from "~/installed-game/type/Game";
import { ArkiniAppVersion } from "~shared/ArkiniAppMetadata";

import { GameEngineResourceLayer } from "~/installed-game/layer/GameEngineResourceLayer";

import type { InstalledGameEngineResource } from "~/installed-game/type/Game";

import {
	GameEngineResourceFx,
	type GameEngineLease,
} from "~/installed-game/service/GameEngineResourceFx";

import { createGameEngineResourceFx } from "~/playable-game/fx/createGameEngineResourceFx";

import { testArkpackConfig } from "~test/arkpack-support/fx/createTestArkpack";

import { makeTestGameTransitionFieldsFx } from "~test/support/makeTestGameTransitionFieldsFx";

import { testGameRead } from "~test/support/testGameRead";

export const runtimes: Array<ManagedRuntime.ManagedRuntime<GameEngineResourceFx, never>> = [];

export const makeResource = ({
	disposeFx = Effect.void,
	disposeWithoutSaveFx = Effect.void,
	packageId,
}: {
	readonly disposeFx?: Game["disposeFx"];
	readonly disposeWithoutSaveFx?: Game["disposeWithoutSaveFx"];
	readonly packageId: string;
}) =>
	Effect.runSync(
		createGameEngineResourceFx<Game>({
			arkpack: {
				packageId,
				contentHash: `content:${packageId}`,
				title: testArkpackConfig.meta.title,
				version: "1.0",
				arkini: ArkiniAppVersion,
				provenance: {
					type: "community",
				},
				source: "user",
			},
			config: testArkpackConfig,
			disposeFx,
			disposeWithoutSaveFx,
			flushSaveFx: Effect.void,
			getResourceUrl: () => "blob:test",
			...Effect.runSync(
				makeTestGameTransitionFieldsFx({} as ReturnType<Game["getSnapshot"]>),
			),
			read: testGameRead,
			run: (() => Promise.reject(new Error("Not used by this test."))) as Game["run"],
			saveKey: {
				packageId,
			},
			subscribe: () => () => undefined,
			subscribeEvents: () => () => undefined,
		}),
	);

export const createHarness = (
	createResourceFx: (packageId: string) => Effect.Effect<InstalledGameEngineResource, unknown>,
	clearSaveFx: Parameters<typeof GameEngineResourceLayer>[0]["clearSaveFx"] = () => Effect.void,
) => {
	const runtime = ManagedRuntime.make(
		GameEngineResourceLayer({
			clearSaveFx,
			createResourceFx,
		}),
	);
	runtimes.push(runtime);

	const acquireLeaseEffect = (packageId: string, scope: Scope.Closeable) =>
		GameEngineResourceFx.pipe(
			Effect.flatMap((service) =>
				service.acquireLeaseFx({
					packageId,
				}),
			),
			Effect.provideService(Scope.Scope, scope),
		);

	const startLease = (packageId: string) => {
		const scope = Effect.runSync(Scope.make());
		return {
			close: () => Effect.runPromise(Scope.close(scope, Exit.void)),
			promise: runtime.runPromise(acquireLeaseEffect(packageId, scope)),
		};
	};

	const recoverFailedSaveEffect = (packageId: string) =>
		GameEngineResourceFx.pipe(
			Effect.flatMap((service) =>
				service.recoverFailedSaveFx({
					packageId,
				}),
			),
		);
	const claimForCloseEffect = GameEngineResourceFx.pipe(
		Effect.flatMap((service) => service.claimForCloseFx),
	);

	return {
		prepareEditorHandoff: () =>
			runtime.runPromise(
				GameEngineResourceFx.pipe(
					Effect.flatMap((service) => service.prepareEditorHandoffFx),
				),
			),
		claimForClose: () => runtime.runPromise(claimForCloseEffect),
		close: (resource: InstalledGameEngineResource) =>
			runtime.runPromise(
				GameEngineResourceFx.pipe(Effect.flatMap((service) => service.closeFx(resource))),
			),
		adopt: (lease: GameEngineLease) =>
			runtime.runPromise(
				GameEngineResourceFx.pipe(Effect.flatMap((service) => service.adoptLeaseFx(lease))),
			),
		current: () =>
			runtime.runPromise(
				GameEngineResourceFx.pipe(Effect.flatMap((service) => service.currentFx)),
			),
		discardFailed: (packageId: string) =>
			runtime.runPromise(
				GameEngineResourceFx.pipe(
					Effect.flatMap((service) => service.discardFailedFx(packageId)),
				),
			),
		recoverFailedSave: (packageId: string) =>
			runtime.runPromise(recoverFailedSaveEffect(packageId)),
		release: (resource: InstalledGameEngineResource) =>
			runtime.runPromise(
				GameEngineResourceFx.pipe(
					Effect.flatMap((service) =>
						service.releaseFx({
							resource,
						}),
					),
				),
			),
		releaseAlreadyFinalized: (resource: InstalledGameEngineResource) =>
			runtime.runPromise(
				GameEngineResourceFx.pipe(
					Effect.flatMap((service) =>
						service.releaseFx({
							allowAlreadyFinalized: true,
							resource,
						}),
					),
				),
			),
		reset: (resource: InstalledGameEngineResource) =>
			runtime.runPromise(
				GameEngineResourceFx.pipe(
					Effect.flatMap((service) =>
						service.resetFx({
							resource,
						}),
					),
				),
			),
		runtime,
		startRecovery: (packageId: string) => {
			const fiber = runtime.runFork(recoverFailedSaveEffect(packageId));
			return {
				interrupt: () => Effect.runPromise(Fiber.interrupt(fiber)),
				promise: Effect.runPromise(Fiber.join(fiber)),
			};
		},
		startCloseClaim: () => {
			const fiber = runtime.runFork(claimForCloseEffect);
			return {
				exit: Effect.runPromise(Fiber.await(fiber)),
				interrupt: () => Effect.runPromise(Fiber.interrupt(fiber)),
			};
		},
		startLease,
		startLeaseExit: (packageId: string) => {
			const scope = Effect.runSync(Scope.make());
			return {
				close: () => Effect.runPromise(Scope.close(scope, Exit.void)),
				promise: runtime.runPromiseExit(acquireLeaseEffect(packageId, scope)),
			};
		},
	};
};

afterEach(async () => {
	for (const runtime of runtimes.splice(0)) {
		await runtime.dispose();
	}
});
