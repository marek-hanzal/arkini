import { Effect } from "effect";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { BoardLayerControl } from "~/game-scene/fx/createBoardLayerControlFx";

interface Props {
	readonly control: BoardLayerControl;
	readonly window: Window;
	readonly document: Document;
}

export namespace bindBoardLayerKeyboardFx {
	export interface Output {
		readonly closeFx: Effect.Effect<void>;
	}
}

/** Alt/Option is only an input adapter; layer intent also accepts menu and button commands. */
export const bindBoardLayerKeyboardFx = Effect.fn("bindBoardLayerKeyboardFx")(
	({ control, window, document }: Props) =>
		Effect.sync((): bindBoardLayerKeyboardFx.Output => {
			let closed = false;
			const releaseFn = () => RendererRuntime.runSync(control.setGroundHeldFx(false));
			const keyDownFn = (event: KeyboardEvent) => {
				const target = event.target;
				if (
					event.key !== "Alt" ||
					event.repeat ||
					event.defaultPrevented ||
					event.ctrlKey ||
					event.metaKey ||
					(target instanceof Element &&
						(target.closest("input, textarea, select") !== null ||
							(target instanceof HTMLElement && target.isContentEditable)))
				)
					return;
				event.preventDefault();
				RendererRuntime.runSync(control.setGroundHeldFx(true));
			};
			const keyUpFn = (event: KeyboardEvent) => {
				if (event.key === "Alt") releaseFn();
			};
			const visibilityFn = () => {
				if (document.hidden) releaseFn();
			};
			window.addEventListener("keydown", keyDownFn);
			window.addEventListener("keyup", keyUpFn);
			window.addEventListener("blur", releaseFn);
			document.addEventListener("visibilitychange", visibilityFn);
			return {
				closeFx: Effect.sync(() => {
					if (closed) return;
					closed = true;
					window.removeEventListener("keydown", keyDownFn);
					window.removeEventListener("keyup", keyUpFn);
					window.removeEventListener("blur", releaseFn);
					document.removeEventListener("visibilitychange", visibilityFn);
					releaseFn();
				}),
			};
		}),
);
