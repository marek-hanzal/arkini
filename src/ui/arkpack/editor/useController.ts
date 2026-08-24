import { useMemo, useRef, useState, type RefObject } from "react";

export namespace useController {
	export interface Props {
		readonly blocked: boolean;
		readonly onFile: (file: File | undefined) => void;
	}

	export interface Output {
		readonly dragging: boolean;
		readonly inputRef: RefObject<HTMLInputElement | null>;
		readonly enterDrag: () => void;
		readonly leaveDrag: () => void;
		readonly openPicker: () => void;
		readonly selectFile: (file: File | undefined) => void;
		readonly dropFile: (file: File | undefined) => void;
	}
}

export const useController = ({ blocked, onFile }: useController.Props): useController.Output => {
	const inputRef = useRef<HTMLInputElement>(null);
	const [dragDepth, setDragDepth] = useState(0);
	const dragging = dragDepth > 0;

	return useMemo(() => {
		const selectFile = (file: File | undefined) => {
			if (blocked) return;
			onFile(file);
			if (inputRef.current !== null) inputRef.current.value = "";
		};

		return {
			dragging,
			dropFile: (file) => {
				setDragDepth(0);
				selectFile(file);
			},
			enterDrag: () => {
				if (blocked) return;
				setDragDepth((depth) => depth + 1);
			},
			inputRef,
			leaveDrag: () => {
				if (blocked) return;
				setDragDepth((depth) => Math.max(0, depth - 1));
			},
			openPicker: () => {
				if (!blocked) inputRef.current?.click();
			},
			selectFile,
		};
	}, [
		blocked,
		dragging,
		onFile,
	]);
};
