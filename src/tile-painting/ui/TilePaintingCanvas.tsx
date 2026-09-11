import { LoaderCircle } from "lucide-react";
import { memo } from "react";
import { useTilePaintingCanvasController } from "~/tile-painting/ui/useTilePaintingCanvasController";

export namespace TilePaintingCanvas {
	export interface Props extends useTilePaintingCanvasController.Props {}
}

export const TilePaintingCanvas = memo(function TilePaintingCanvas(
	props: TilePaintingCanvas.Props,
) {
	const controller = useTilePaintingCanvasController(props);
	return (
		<div
			ref={controller.viewportRef}
			data-ui="TilePaintingCanvas"
			className="relative size-full min-h-72 overflow-hidden bg-canvas"
			style={{
				touchAction: "none",
				cursor: "crosshair",
			}}
		>
			<canvas
				ref={controller.canvasRef}
				data-ui="TilePaintingSurface"
				style={{
					position: "absolute",
					pointerEvents: "none",
					backgroundColor: "#e5dce1",
					backgroundImage:
						"conic-gradient(#c6bac4 25%, transparent 0 50%, #c6bac4 0 75%, transparent 0)",
					backgroundSize: "20px 20px",
					boxShadow: "0 0 0 1px #582a51",
				}}
			/>
			<div
				ref={controller.cursorRef}
				data-ui="TilePaintingBrushPreview"
				className="invisible pointer-events-none absolute border border-white shadow-[0_0_0_1px_#31192b]"
				style={{
					left: 0,
					top: 0,
					backgroundSize: "contain",
					backgroundRepeat: "no-repeat",
					backgroundPosition: "center",
				}}
			/>
			<div
				ref={controller.loadingRef}
				data-ui="TilePaintingCanvasLoading"
				className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground"
			>
				<LoaderCircle className="size-5 animate-spin" />
			</div>
		</div>
	);
});
