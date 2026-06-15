import { useDraggable, type Data } from "@dnd-kit/core";
import {
	type FC,
	type HTMLAttributes,
	type KeyboardEvent as ReactKeyboardEvent,
	memo,
	type PointerEvent as ReactPointerEvent,
	type ReactNode,
	useCallback,
	useMemo,
} from "react";
import type { DraggablePayload } from "~/drag/DraggablePayload";
import { cn } from "~/shared/cn";
import { usePressActions } from "~/shared/hook/usePressActions";

export namespace DraggableSurface {
	export interface Props extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
		id: string;
		nodeId?: string;
		payload: DraggablePayload<string, unknown, unknown>;
		hidden: boolean;
		dragDisabled?: boolean;
		delaySingleWhenDouble?: boolean;
		onSingleActivate?(): void;
		onDoubleActivate?(): void;
		onLongActivate?(): void;
		children: ReactNode;
	}
}

export const DraggableSurface: FC<DraggableSurface.Props> = memo(
	({
		id,
		nodeId = id,
		payload,
		hidden,
		className,
		dragDisabled = false,
		delaySingleWhenDouble = false,
		onSingleActivate,
		onDoubleActivate,
		onLongActivate,
		children,
		...props
	}) => {
		const data = useMemo(
			() =>
				({
					...payload,
					sourceNodeId: payload.sourceNodeId ?? nodeId,
				}) satisfies DraggablePayload<string, unknown, unknown>,
			[
				nodeId,
				payload,
			],
		);
		const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
			id,
			data: data as unknown as Data,
			disabled: dragDisabled,
		});
		const press = usePressActions({
			onSingle: onSingleActivate,
			onDouble: onDoubleActivate,
			onLong: onLongActivate,
			delaySingleWhenDouble,
			isDisabled: dragDisabled,
		});
		const pressProps = press.pressProps as HTMLAttributes<HTMLDivElement>;
		const pointerDown = useCallback(
			(event: ReactPointerEvent<HTMLDivElement>) => {
				pressProps.onPointerDown?.(event);
				listeners?.onPointerDown?.(event);
			},
			[
				listeners,
				pressProps,
			],
		);
		const keyDown = useCallback(
			(event: ReactKeyboardEvent<HTMLDivElement>) => {
				pressProps.onKeyDown?.(event);
				listeners?.onKeyDown?.(event);
			},
			[
				listeners,
				pressProps,
			],
		);

		return (
			<div
				ref={setNodeRef}
				data-drag-node-id={nodeId}
				{...attributes}
				{...props}
				{...pressProps}
				className={cn(
					className,
					(hidden || (isDragging && data.hideWhenActive !== false)) &&
						"pointer-events-none opacity-0",
				)}
				onKeyDown={keyDown}
				onPointerDown={pointerDown}
			>
				{children}
			</div>
		);
	},
);
