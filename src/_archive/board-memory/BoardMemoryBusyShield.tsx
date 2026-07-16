import { type FC, useEffect, useState } from "react";
import type { BoardMemoryOperationState } from "~/board-memory/BoardMemoryOperationContext";
import { cn } from "~/ui/cn";

const boardMemoryBusyShieldFadeMs = 180;

export namespace BoardMemoryBusyShield {
	export interface Props {
		operation?: BoardMemoryOperationState;
	}
}

const readOperationKey = (operation: BoardMemoryOperationState | undefined) =>
	operation
		? `${operation.type}:${operation.boardItemId}:${operation.startedAtMs}:${operation.readyAtMs}`
		: undefined;

export const BoardMemoryBusyShield: FC<BoardMemoryBusyShield.Props> = ({ operation }) => {
	const [renderedOperation, setRenderedOperation] = useState<
		BoardMemoryOperationState | undefined
	>(operation);
	const [visible, setVisible] = useState(false);
	const operationKey = readOperationKey(operation);

	useEffect(() => {
		let frame: number | undefined;
		let timeout: ReturnType<typeof globalThis.setTimeout> | undefined;

		if (operation) {
			setRenderedOperation(operation);
			setVisible(false);
			frame = globalThis.requestAnimationFrame(() => setVisible(true));
		} else {
			setVisible(false);
			timeout = globalThis.setTimeout(
				() => setRenderedOperation(undefined),
				boardMemoryBusyShieldFadeMs,
			);
		}

		return () => {
			if (frame !== undefined) globalThis.cancelAnimationFrame(frame);
			if (timeout !== undefined) globalThis.clearTimeout(timeout);
		};
	}, [
		operation,
		operationKey,
	]);

	if (!renderedOperation) return null;

	return (
		<div
			data-state={visible ? "visible" : "hidden"}
			data-ui="board memory busy shield"
			className={cn(
				"absolute inset-0 transition-[opacity,backdrop-filter,background-color] duration-200 ease-out",
				operation ? "pointer-events-auto" : "pointer-events-none",
				visible
					? "bg-fuchsia-100/45 opacity-100 backdrop-blur-[1px]"
					: "bg-fuchsia-100/0 opacity-0 backdrop-blur-none",
			)}
			style={{
				zIndex: "var(--ak-layer-toast)",
			}}
		/>
	);
};
