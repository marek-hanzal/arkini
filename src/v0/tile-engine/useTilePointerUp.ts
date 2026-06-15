import { type PointerEvent as ReactPointerEvent, type RefObject, useCallback } from "react";
import { dragSessionRect } from "~/v0/tile-engine/dragSessionRect";
import { dropOutcomeCommit } from "~/v0/tile-engine/dropOutcomeCommit";
import { dropOutcomeKind } from "~/v0/tile-engine/dropOutcomeKind";
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
		animateBack(): Promise<void>;
		animateToTarget(targetRect: TileEngine.Rect | null): Promise<void>;
		resolveDrop(rect: TileEngine.Rect): TileEngineDrop.Resolved<TSlot, TTile, TDrop> | null;
		finishDrag(): void;
		setActiveDropId(dropId: string | null): void;
		setHandoff(handoff: TileEngineActor.Handoff | null): void;
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
}: useTilePointerUp.Props<TTile, TSlot, TDrag, TDrop>) =>
	useCallback(
		(event: ReactPointerEvent<HTMLDivElement>) => {
			const session = dragSessionRef.current;
			if (!session || session.pointerId !== event.pointerId) return;

			const element = actorRef.current;
			releasePointerCapture(element, event.pointerId);
			clearLongTimer();

			if (!session.started) {
				const longFired = session.longFired;
				dragSessionRef.current = null;
				resetElementTransform(element);
				if (!longFired) handleTap(event);
				return;
			}

			const releaseRect = element ? rectFromElement(element) : dragSessionRect(session);
			const resolved = resolveDrop(releaseRect);
			setActiveDropId(null);

			void (async () => {
				try {
					const sourceTile = tileRef.current;
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
					const commit = dropOutcomeCommit(outcome);

					if (kind === "accept" && resolved?.element) {
						await animateToTarget(rectFromElement(resolved.element));
						if (resolved.slot) {
							setHandoff({
								tileId: sourceTile.id,
								targetSlotId: resolved.slot.id,
							});
						}
						try {
							await commit?.();
							return;
						} catch {
							setHandoff(null);
							await animateBack();
							return;
						}
					}

					setHandoff(null);
					await animateBack();
				} catch {
					setHandoff(null);
					await animateBack();
				} finally {
					finishDrag();
					resetElementTransform(actorRef.current);
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
			tileRef,
		],
	);
