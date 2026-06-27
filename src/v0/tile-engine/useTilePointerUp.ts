import { type PointerEvent as ReactPointerEvent, type RefObject, useCallback } from "react";
import { DebugTimeline } from "~/v0/diagnostics/DebugTimeline";
import { dragSessionRect } from "~/v0/tile-engine/dragSessionRect";
import { createTileDropMotionId } from "~/v0/tile-engine/createTileDropMotionId";
import { dropOutcomeAnimation } from "~/v0/tile-engine/dropOutcomeAnimation";
import { dropOutcomeCommit } from "~/v0/tile-engine/dropOutcomeCommit";
import { dropOutcomeKind } from "~/v0/tile-engine/dropOutcomeKind";
import { finishTileTapRelease } from "~/v0/tile-engine/finishTileTapRelease";
import { releasePointerCapture } from "~/v0/tile-engine/releasePointerCapture";
import { resetElementTransform } from "~/v0/tile-engine/resetElementTransform";
import { rectFromElement } from "~/v0/tile-engine/rect";
import { runTileDropCommit } from "~/v0/tile-engine/runTileDropCommit";
import { runTileDropMotion } from "~/v0/tile-engine/runTileDropMotion";
import type { TileEngineActor } from "~/v0/tile-engine/TileEngineActor.types";
import type { TileEngineDrop } from "~/v0/tile-engine/TileEngineDrop.types";
import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";

export namespace useTilePointerUp {
	export interface Props<TTile = unknown, TSlot = unknown, TDrag = unknown, TDrop = unknown> {
		actorRef: RefObject<HTMLDivElement | null>;
		dragSessionRef: RefObject<TileEngineActor.DragSession<TDrag> | null>;
		tileRef: RefObject<TileEngine.Tile<TTile>>;
		dragRef: RefObject<TileEngine.DragConfig<TTile, TSlot, TDrag, TDrop> | undefined>;
		clearLongTimer(): void;
		handleTap(event: Pick<ReactPointerEvent<HTMLDivElement>, "clientX" | "clientY">): void;
		animateBack(): Promise<boolean>;
		animateToTarget(
			targetRect: TileEngine.Rect | null,
			meta?: {
				motionId?: string;
				animation?: TileEngine.DropAnimation;
				role?: "source" | "target";
				fromSlotId?: string;
				toSlotId?: string;
			},
		): Promise<boolean>;
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
			DebugTimeline.record({
				scope: "tile-engine",
				event: "drop.resolved",
				detail: {
					pointerId: event.pointerId,
					dropId: resolved?.dropId ?? null,
					hasSlot: Boolean(resolved?.slot),
					hasTargetTile: Boolean(resolved?.targetTile),
					releaseRect,
					source: session.source,
					target: resolved?.payload ?? null,
				},
			});
			setActiveDropId(null);

			void (async () => {
				let resetAfterMotion = true;
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
					const animation = dropOutcomeAnimation(outcome);
					const commit = dropOutcomeCommit(outcome);
					DebugTimeline.record({
						scope: "tile-engine",
						event: "drop.outcome",
						detail: {
							motionId,
							kind,
							animation,
							hasCommit: Boolean(commit),
							sourceTileId: sourceTile.id,
							sourceSlotId: sourceTile.slotId,
							targetTileId: resolved?.targetTile?.id,
							targetSlotId: resolved?.slot?.id,
						},
					});

					if (kind === "accept" && animation === "parallel-merge") {
						if (
							await runTileDropCommit({
								motionId,
								animation,
								commit,
								immediate: true,
							})
						) {
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
								motionId,
								animation,
								commit,
							})
						) {
							return;
						}

						setHandoff(null);
						resetAfterMotion = await animateBack();
						return;
					}

					setHandoff(null);
					resetAfterMotion = await animateBack();
				} catch {
					DebugTimeline.record({
						scope: "tile-engine",
						event: "drop.error",
					});
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
