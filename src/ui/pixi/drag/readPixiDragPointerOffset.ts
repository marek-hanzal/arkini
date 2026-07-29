interface PressedDrag {
	readonly pointerId: number;
	readonly pressX: number;
	readonly pressY: number;
	readonly phase: "dragging" | "pressed" | "submitting";
}

/** Validates pointer ownership and reads displacement from the admitted press. */
export const readPixiDragPointerOffset = <Drag extends PressedDrag>(
	event: {
		readonly global: {
			readonly x: number;
			readonly y: number;
		};
		readonly pointerId: number;
	},
	drag: Drag | null,
) => {
	if (drag === null || drag.phase === "submitting" || event.pointerId !== drag.pointerId) {
		return null;
	}
	return {
		drag,
		offsetX: event.global.x - drag.pressX,
		offsetY: event.global.y - drag.pressY,
	};
};
