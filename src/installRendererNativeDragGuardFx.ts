import { Effect } from "effect";

export namespace installRendererNativeDragGuardFx {
	export interface Props {
		readonly root: HTMLElement;
	}
}

/**
 * Prevents Chromium's native link, image, and text drag payloads inside the renderer application.
 *
 * Gameplay drag remains unaffected because Pixi owns it through pointer events rather than the
 * browser drag-and-drop API.
 */
export const installRendererNativeDragGuardFx = Effect.fn("installRendererNativeDragGuardFx")(
	({ root }: installRendererNativeDragGuardFx.Props) =>
		Effect.sync(() => {
			const preventNativeDrag = (event: DragEvent) => {
				event.preventDefault();
			};
			root.addEventListener("dragstart", preventNativeDrag, {
				capture: true,
			});
			return () => {
				root.removeEventListener("dragstart", preventNativeDrag, {
					capture: true,
				});
			};
		}),
);
