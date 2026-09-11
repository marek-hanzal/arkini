import { useLayoutEffect, useRef, type RefObject } from "react";
import { Effect, Exit, Scope } from "effect";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { attachTilePaintingCanvasFx } from "~/tile-painting/fx/attachTilePaintingCanvasFx";
import type { makeTilePaintingSessionFx } from "~/tile-painting/fx/makeTilePaintingSessionFx";

export namespace useTilePaintingCanvasController {
	export interface Props {
		readonly session: makeTilePaintingSessionFx.Output;
		readonly suspended?: boolean;
	}
	export interface Output {
		readonly viewportRef: RefObject<HTMLDivElement | null>;
		readonly canvasRef: RefObject<HTMLCanvasElement | null>;
		readonly cursorRef: RefObject<HTMLDivElement | null>;
		readonly loadingRef: RefObject<HTMLDivElement | null>;
	}
}

/** React owns attachment only; input, geometry, gesture settlement and frames belong to the native surface. */
export const useTilePaintingCanvasController = ({
	session,
	suspended = false,
}: useTilePaintingCanvasController.Props): useTilePaintingCanvasController.Output => {
	const viewportRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const cursorRef = useRef<HTMLDivElement>(null);
	const loadingRef = useRef<HTMLDivElement>(null);
	const ownerRef = useRef<attachTilePaintingCanvasFx.Output | undefined>(undefined);
	useLayoutEffect(() => {
		const viewportElement = viewportRef.current;
		const canvas = canvasRef.current;
		const cursorElement = cursorRef.current;
		const loadingElement = loadingRef.current;
		if (
			viewportElement === null ||
			canvas === null ||
			cursorElement === null ||
			loadingElement === null
		)
			return;
		const scope = RendererRuntime.runSync(Scope.make());
		ownerRef.current = RendererRuntime.runSync(
			attachTilePaintingCanvasFx({
				session,
				viewportElement,
				canvas,
				cursorElement,
				loadingElement,
			}).pipe(Effect.provideService(Scope.Scope, scope)),
		);
		return () => {
			ownerRef.current = undefined;
			RendererRuntime.runSync(Scope.close(scope, Exit.void));
		};
	}, [
		session,
	]);
	useLayoutEffect(() => {
		if (ownerRef.current !== undefined)
			RendererRuntime.runSync(ownerRef.current.setSuspendedFx(suspended));
	}, [
		session,
		suspended,
	]);
	return {
		viewportRef,
		canvasRef,
		cursorRef,
		loadingRef,
	};
};
