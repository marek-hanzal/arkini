import { type PointerEvent as ReactPointerEvent, type RefObject, useCallback } from "react";
import { dragSessionRect } from "~/tile-engine/dragSessionRect";
import { createTileDropMotionId } from "~/tile-engine/createTileDropMotionId";
import { dropOutcomeAnimation } from "~/tile-engine/dropOutcomeAnimation";
import { dropOutcomeCommit } from "~/tile-engine/dropOutcomeCommit";
import { dropOutcomeKind } from "~/tile-engine/dropOutcomeKind";
import { finishTileTapRelease } from "~/tile-engine/finishTileTapRelease";
import { releasePointerCapture } from "~/tile-engine/releasePointerCapture";
import { resetDropConsumeVisual } from "~/tile-engine/resetDropConsumeVisual";
import { resetElementTransform } from "~/tile-engine/resetElementTransform";
import { rectFromElement } from "~/tile-engine/rect";
import { runTileDropCommit } from "~/tile-engine/runTileDropCommit";
import { runTileDropMotion } from "~/tile-engine/runTileDropMotion";
import type { TileEngineActor } from "~/tile-engine/TileEngineActor.types";
import type { TileEngineDrop } from "~/tile-engine/TileEngineDrop.types";
import type { TileEngine } from "~/tile-engine/TileEngine.types";

export namespace useTilePointerUp {
	export interface Props<TTile = unknown, TSlot = unknown, TDrag = unknown, TDrop = unknown> {
		actorRef: RefObject<HTMLDivElement | null>;
		dragSessionRef: RefObject<TileEngineActor.DragSession<TDrag> | null>;
		tileRef: RefObject<TileEngine.Tile<TTile>>;
		dragRef: RefObject<TileEngine.DragConfig<TTile, TSlot, TDrag, TDrop> | undefined>;
		clearLongTimer(): void;
		handleTap(event: Pick<ReactPointerEvent<HTMLDivElement>, "clientX" | "clientY">): void;
		animateBack(): Promise<boolean>;
		animateToTarget(targetRect: TileEngine.Rect | null): Promise<boolean>;
		resolveDrop(rect: TileEngine.Rect): TileEngineDrop.Resolved<TSlot, TTile, TDrop> | null;
		finishDrag(): void;
		setActiveDropId(dropId: string | null): void;
		setHandoff(handoff: TileEngineActor.Handoff | null): void;
		setHandoffs(handoffs: readonly TileEngineActor.Handoff[]): void;
	}
}

export const useTilePointerUp = <TTile, TSlot, TDrag, TDrop>({
	actorRef,
	dragSessionRef,
	tileRef,
	dragRef,
	clearLongTimer,
	handleTap,
	animateBack,
	animateToTarget,
	resolveDrop,
	finishDrag,
	setActiveDropId,
	setHandoff,
	setHandoffs,
}: useTilePointerUp.Props<TTile, TSlot, TDrag, TDrop>) =>
	useCallback(
		(event: ReactPointerEvent<HTMLDivElement>) => {
			const session = dragSessionRef.current;
			if (!session || session.pointerId !== event.pointerId) return;

			const element = actorRef.current;
			releasePointerCapture(element, event.pointerId);
			clearLongTimer();

			if (!session.started) {
				finishTileTapRelease({
					event,
					session,
					element,
					dragSessionRef,
					handleTap,
				});
				return;
			}

			const releaseRect = element ? rectFromElement(element) : dragSessionRect(session);
			const resolved = resolveDrop(releaseRect);

			setActiveDropId(null);

			void (async () => {
				let resetAfterMotion = true;
				let resolvedAnimation: TileEngine.DropAnimation | undefined;
				try {
					const sourceTile = tileRef.current;
					const motionId = createTileDropMotionId({
						pointerId: event.pointerId,
						sourceTileId: sourceTile.id,
					});
					const outcome = await dragRef.current?.onDrop?.({
						source: session.source,
						target: resolved?.payload ?? null,
						sourceTile,
						targetSlot: resolved?.slot ?? null,
						targetTile: resolved?.targetTile ?? null,
						dragRect: releaseRect,
						targetRect: resolved?.element ? rectFromElement(resolved.element) : null,
					});
					const kind = dropOutcomeKind(outcome);
					const notifyDropSettled = () =>
						dragRef.current?.onDropSettled?.({
							kind,
							source: session.source,
							sourceTile,
							target: resolved?.payload ?? null,
							targetSlot: resolved?.slot ?? null,
							targetTile: resolved?.targetTile ?? null,
						});
					if (kind !== "accept") notifyDropSettled();
					const animation = dropOutcomeAnimation(outcome);
					resolvedAnimation = animation;
					const commit = dropOutcomeCommit(outcome);

					if (kind === "accept" && animation === "parallel-merge") {
						if (
							await runTileDropCommit({
								commit,
							})
						) {
							notifyDropSettled();
							return;
						}

						setHandoff(null);
						resetAfterMotion = await animateBack();
						return;
					}

					if (kind === "accept" && resolved?.element) {
						const motion = await runTileDropMotion({
							sourceElement: element,
							session,
							sourceTile,
							resolved,
							motionId,
							animation,
							animateToTarget,
						});

						if (!motion.completed) {
							resetAfterMotion = false;
							return;
						}

						setHandoffs(motion.handoffs);
						if (
							await runTileDropCommit({
								commit,
							})
						) {
							notifyDropSettled();
							if (animation === "consume") resetAfterMotion = false;
							return;
						}

						if (animation === "consume") resetDropConsumeVisual(element);
						setHandoff(null);
						resetAfterMotion = await animateBack();
						return;
					}

					setHandoff(null);
					resetAfterMotion = await animateBack();
				} catch {
					if (resolvedAnimation === "consume") resetDropConsumeVisual(element);
					setHandoff(null);
					resetAfterMotion = await animateBack();
				} finally {
					finishDrag();
					if (resetAfterMotion) resetElementTransform(actorRef.current);
				}
			})();
		},
		[
			actorRef,
			animateBack,
			animateToTarget,
			clearLongTimer,
			dragRef,
			dragSessionRef,
			finishDrag,
			handleTap,
			resolveDrop,
			setActiveDropId,
			setHandoff,
			setHandoffs,
			tileRef,
		],
	);
