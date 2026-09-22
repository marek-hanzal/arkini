import { useGameAudioControl } from "~/game-audio/ui/useGameAudioControl";
import { PresentationSfxEventEnumSchema } from "~/sfx-event/schema/PresentationSfxEventEnumSchema";
import { useAtom } from "@effect/atom-react";
import { match } from "ts-pattern";
import { useCallback, useEffect, useRef } from "react";

import { useTileCommands } from "~/tile-interaction/ui/useTileCommands";
import { useGameEngine } from "~/game-presentation/ui/useGameEngine";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { TileDefaultLineCommandAtom } from "~/tile-interaction/atom/TileDefaultLineCommandAtom";
import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import { useBoardRuntime } from "~/game-scene/ui/useBoardRuntime";
import { useItemDetailControl } from "~/item-detail-frame/ui/useItemDetailControl";
import type { MainActivationIntent } from "~/tile-interaction/type/MainActivationIntent";
import { createMainRuntimeFx } from "~/game-scene/fx/createMainRuntimeFx";
import { PointerDragThreshold } from "~/ui/constant/PointerDragThreshold";
import { usePixiGameRuntime } from "~/game-scene/ui/PixiGameRuntime";

/**
 * Mounts the one Pixi-native Board scene into the React-owned game shell.
 *
 * Right click performs the canonical primary action, Ctrl+right click fills its default-line queue,
 * Left click opens Item Detail. React forwards commands
 * and overlay cancellation only; the scene runtime owns pointer and display lifecycle.
 */
export const PixiBoardSurface = () => {
	const game = useGameEngine();
	const { playSfxEventFn } = useGameAudioControl();
	const onRejectedDropFn = useCallback(
		() => playSfxEventFn(PresentationSfxEventEnumSchema.enum.ItemDropRejected),
		[
			playSfxEventFn,
		],
	);
	const { runDropFn } = useTileCommands(game);
	const itemDetail = useItemDetailControl();
	const { textures } = usePixiGameRuntime();
	const [enqueueLineState, enqueueLineFn] = useAtom(TileDefaultLineCommandAtom(game));
	const controlsRef = useRef({
		itemDetail,
	});
	controlsRef.current = {
		itemDetail,
	};

	const activateFn = useCallback(
		async (item: TileActorItem, intent: MainActivationIntent, origin: HTMLElement) => {
			const { itemDetail: currentItemDetail } = controlsRef.current;
			if (intent === "detail") {
				RendererRuntime.runSync(
					currentItemDetail.openItemDetailFx({
						itemId: item.id,
						origin,
					}),
				);
				return;
			}
			if (intent === "fill-default-line-queue") {
				if (
					item.location.scope !== "board" ||
					item.primaryAction.kind !== "enqueue-default-line"
				) {
					return;
				}
				enqueueLineFn({
					kind: "fill",
					ownerItemId: item.id,
				});
				return;
			}
			await match(item.primaryAction)
				.with(
					{
						kind: "none",
					},
					() => Promise.resolve(),
				)
				.with(
					{
						kind: "enqueue-default-line",
					},
					() => {
						enqueueLineFn({
							kind: "enqueue",
							ownerItemId: item.id,
						});
					},
				)
				.exhaustive();
		},
		[
			enqueueLineFn,
		],
	);

	const createRuntimeFx = useCallback(
		(host: HTMLElement) =>
			createMainRuntimeFx({
				dragThreshold: PointerDragThreshold,
				game,
				host,
				onActivateFn: activateFn,
				onDropFn: runDropFn,
				onRejectedDropFn,
				textures,
			}),
		[
			activateFn,
			game,
			runDropFn,
			onRejectedDropFn,
			textures,
		],
	);
	const { hostRef } = useBoardRuntime({
		createRuntimeFx,
		game,
	});

	useEffect(() => {
		if (enqueueLineState.kind !== "error") return;
		enqueueLineFn({
			kind: "reset",
		});
	}, [
		enqueueLineFn,
		enqueueLineState,
	]);

	return (
		<div
			ref={hostRef}
			className="size-full min-h-0 min-w-0"
			data-ui="PixiBoardSurface"
			onContextMenu={(event) => event.preventDefault()}
		/>
	);
};
