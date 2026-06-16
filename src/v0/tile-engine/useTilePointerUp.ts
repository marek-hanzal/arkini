import { type PointerEvent as ReactPointerEvent, type RefObject, useCallback } from "react";
import { DebugTimeline } from "~/v0/debug/DebugTimeline";
import { animateElementToRect } from "~/v0/tile-engine/animateElementToRect";
import { dragSessionRect } from "~/v0/tile-engine/dragSessionRect";
import { dropOutcomeAnimation } from "~/v0/tile-engine/dropOutcomeAnimation";
import { dropOutcomeCommit } from "~/v0/tile-engine/dropOutcomeCommit";
import { dropOutcomeKind } from "~/v0/tile-engine/dropOutcomeKind";
import { findTileEngineActorElement } from "~/v0/tile-engine/findTileEngineActorElement";
import { releasePointerCapture } from "~/v0/tile-engine/releasePointerCapture";
import { resetElementTransform } from "~/v0/tile-engine/resetElementTransform";
import { rectFromElement } from "~/v0/tile-engine/rect";
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

const createDropMotionId = ({
	pointerId,
	sourceTileId,
}: {
	pointerId: number;
	sourceTileId: string;
}) => `drop:${sourceTileId}:${pointerId}:${Math.round(performance.now() * 100)}`;

const createSourceHandoff = ({
	sourceTile,
	resolved,
}: {
	sourceTile: TileEngine.Tile<unknown>;
	resolved: TileEngineDrop.Resolved<unknown, unknown, unknown>;
}): TileEngineActor.Handoff | undefined =>
	resolved.slot
		? {
				tileId: sourceTile.id,
				targetSlotId: resolved.slot.id,
			}
		: undefined;

const createTargetHandoff = ({
	sourceTile,
	resolved,
}: {
	sourceTile: TileEngine.Tile<unknown>;
	resolved: TileEngineDrop.Resolved<unknown, unknown, unknown>;
}): TileEngineActor.Handoff | undefined =>
	resolved.targetTile
		? {
				tileId: resolved.targetTile.id,
				targetSlotId: sourceTile.slotId,
			}
		: undefined;

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
				DebugTimeline.record({
					scope: "tile-engine",
					event: "pointer.tap-release",
					detail: {
						pointerId: event.pointerId,
						longFired: session.longFired,
						source: session.source,
					},
				});
				const longFired = session.longFired;
				dragSessionRef.current = null;
				resetElementTransform(element);
				if (!longFired) handleTap(event);
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
					const motionId = createDropMotionId({
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

					if (kind === "accept" && resolved?.element) {
						const sourceHandoff = createSourceHandoff({
							sourceTile: sourceTile as TileEngine.Tile<unknown>,
							resolved: resolved as TileEngineDrop.Resolved<
								unknown,
								unknown,
								unknown
							>,
						});
						const targetHandoff = createTargetHandoff({
							sourceTile: sourceTile as TileEngine.Tile<unknown>,
							resolved: resolved as TileEngineDrop.Resolved<
								unknown,
								unknown,
								unknown
							>,
						});
						const targetActorElement =
							animation === "parallel-swap" && element && resolved.targetTile
								? findTileEngineActorElement({
										sourceElement: element,
										tileId: resolved.targetTile.id,
									})
								: null;

						DebugTimeline.record({
							scope: "tile-engine",
							event: "drop.motion.start",
							detail: {
								motionId,
								animation,
								sourceTileId: sourceTile.id,
								sourceFromSlotId: sourceTile.slotId,
								sourceToSlotId: resolved.slot?.id,
								targetTileId: resolved.targetTile?.id,
								targetFromSlotId: resolved.targetTile?.slotId,
								targetToSlotId: sourceTile.slotId,
								parallel: Boolean(targetActorElement),
							},
						});

						const [sourceMotionCompleted, targetMotionCompleted] = await Promise.all([
							animateToTarget(rectFromElement(resolved.element), {
								motionId,
								animation,
								role: "source",
								fromSlotId: sourceTile.slotId,
								toSlotId: resolved.slot?.id,
							}),
							targetActorElement
								? animateElementToRect({
										element: targetActorElement,
										target: session.origin,
										meta: {
											motionId,
											animation,
											role: "target",
											tileId: resolved.targetTile?.id,
											fromSlotId: resolved.targetTile?.slotId,
											toSlotId: sourceTile.slotId,
										},
									})
								: Promise.resolve(true),
						]);

						if (
							!sourceMotionCompleted ||
							(targetActorElement && !targetMotionCompleted)
						) {
							resetAfterMotion = false;
							DebugTimeline.record({
								scope: "tile-engine",
								event: "drop.motion.cancelled",
								detail: {
									motionId,
									animation,
									sourceMotionCompleted,
									targetMotionCompleted,
								},
							});
							return;
						}

						DebugTimeline.record({
							scope: "tile-engine",
							event: "drop.motion.end",
							detail: {
								motionId,
								animation,
								parallel: Boolean(targetActorElement),
							},
						});

						setHandoffs(
							[
								sourceHandoff,
								targetActorElement ? targetHandoff : undefined,
							].filter((handoff): handoff is TileEngineActor.Handoff =>
								Boolean(handoff),
							),
						);
						try {
							DebugTimeline.record({
								scope: "tile-engine",
								event: "drop.commit.start",
								detail: {
									motionId,
									animation,
									hasCommit: Boolean(commit),
								},
							});
							await commit?.();
							DebugTimeline.record({
								scope: "tile-engine",
								event: "drop.commit.ok",
								detail: {
									motionId,
									animation,
								},
							});
							return;
						} catch {
							DebugTimeline.record({
								scope: "tile-engine",
								event: "drop.commit.error",
								detail: {
									motionId,
									animation,
								},
							});
							setHandoff(null);
							resetAfterMotion = await animateBack();
							return;
						}
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
