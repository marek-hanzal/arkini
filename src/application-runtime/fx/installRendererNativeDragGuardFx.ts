import { Effect } from "effect";

interface Props {
	readonly root: HTMLElement;
}

/**
 * Blocks implicit link, image, and text drags while admitting explicitly draggable product controls.
 *
 * Gameplay drag remains unaffected because Pixi owns it through pointer events rather than the
 * browser drag-and-drop API.
 */
export const installRendererNativeDragGuardFx = Effect.fn("installRendererNativeDragGuardFx")(
	({ root }: Props) =>
		Effect.sync(() => {
			const preventNativeDragFn = (event: DragEvent) => {
				if (
					event.target instanceof HTMLElement &&
					event.target.getAttribute("draggable") === "true"
				)
					return;
				event.preventDefault();
			};
			root.addEventListener("dragstart", preventNativeDragFn, {
				capture: true,
			});
			return () => {
				root.removeEventListener("dragstart", preventNativeDragFn, {
					capture: true,
				});
			};
		}),
);
