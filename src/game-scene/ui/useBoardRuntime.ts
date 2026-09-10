import type { Effect } from "effect";
import { useEffect, useLayoutEffect, useRef } from "react";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { GameEngine } from "~/playable-game/type/GameEngine";
import { useGameMenuControl } from "~/game-menu/ui/GameMenuProvider";
import { useItemDetailControl } from "~/item-detail-frame/ui/useItemDetailControl";
import { usePixiGameRuntime } from "~/game-scene/ui/PixiGameRuntime";

interface BoardRuntime {
	readonly cancelInteractionFx: Effect.Effect<void>;
	readonly setInteractionBlockedFx: (blocked: boolean) => Effect.Effect<void>;
	readonly closeFx: Effect.Effect<void>;
}

/** Owns canvas acquisition, overlay blocking and teardown for both routed board surfaces. */
export const useBoardRuntime = <Runtime extends BoardRuntime>({
	createRuntimeFx,
	game,
}: {
	readonly createRuntimeFx: (host: HTMLElement) => Effect.Effect<Runtime, unknown>;
	readonly game: GameEngine;
}) => {
	const gameMenu = useGameMenuControl();
	const itemDetail = useItemDetailControl();
	const { interaction } = usePixiGameRuntime();
	const blocked = gameMenu.phase !== "closed" || itemDetail.state.phase !== "closed";
	const blockedRef = useRef(blocked);
	blockedRef.current = blocked;
	const hostRef = useRef<HTMLDivElement>(null);
	const runtimeRef = useRef<Runtime | null>(null);
	useLayoutEffect(() => {
		const host = hostRef.current;
		if (host === null) return;
		let cancelled = false;
		let runtime: Runtime | null = null;
		let unregisterInteractionFn: () => void = () => undefined;
		void RendererRuntime.runPromise(createRuntimeFx(host))
			.then((created) => {
				if (cancelled) return RendererRuntime.runPromise(created.closeFx);
				runtime = created;
				runtimeRef.current = created;
				RendererRuntime.runSync(created.setInteractionBlockedFx(blockedRef.current));
				unregisterInteractionFn = RendererRuntime.runSync(
					interaction.registerFx(() =>
						RendererRuntime.runSync(created.cancelInteractionFx),
					),
				);
			})
			.catch((cause) => {
				if (!cancelled) game.reportCriticalFailureFn("game-presentation", cause);
			});
		return () => {
			cancelled = true;
			unregisterInteractionFn();
			if (runtimeRef.current === runtime) runtimeRef.current = null;
			if (runtime !== null)
				void RendererRuntime.runPromise(runtime.closeFx).catch((cause) =>
					console.error("Pixi board scene failed to close.", cause),
				);
		};
	}, [
		createRuntimeFx,
		game,
		interaction,
	]);
	useEffect(() => {
		const runtime = runtimeRef.current;
		if (runtime !== null) RendererRuntime.runSync(runtime.setInteractionBlockedFx(blocked));
	}, [
		blocked,
	]);
	return {
		blocked,
		hostRef,
		runtimeRef,
	};
};
