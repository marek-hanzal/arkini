import { forwardRef, type TextareaHTMLAttributes } from "react";
import { twMerge } from "tailwind-merge";

import { editorInputClassName } from "~/ui/form/EditorInputClassName";

export interface EditorTextareaProps
	extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "rows"> {
	readonly minRows?: number;
	readonly maxRows?: number;
}

/** Renders one native textarea that grows with content between explicit row boundaries. */
export const EditorTextarea = forwardRef<HTMLTextAreaElement, EditorTextareaProps>(
	({ className, maxRows = 12, minRows = 6, style, ...props }, ref) => {
		const minimum = Math.max(1, Math.floor(minRows));
		const maximum = Math.max(minimum, Math.max(1, Math.floor(maxRows)));
		return (
			<textarea
				ref={ref}
				className={twMerge(
					editorInputClassName,
					"resize-none overflow-y-auto leading-6",
					className,
				)}
				rows={minimum}
				style={{
					...style,
					fieldSizing: "content",
					minHeight: `calc(${minimum}lh + 1rem + 2px)`,
					maxHeight: `calc(${maximum}lh + 1rem + 2px)`,
				}}
				{...props}
			/>
		);
	},
);

EditorTextarea.displayName = "EditorTextarea";
