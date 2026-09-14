import { forwardRef, type ButtonHTMLAttributes } from "react";

import { Button } from "~/ui/ui/Button";

/** Keeps icon-only Editor form actions aligned with collection navigation controls. */
export const EditorIconButton = forwardRef<
	HTMLButtonElement,
	ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => (
	<Button
		ref={ref}
		className={`size-[var(--ak-control-min-height)] shrink-0 border-0 bg-transparent p-0 shadow-none hover:border-transparent hover:bg-surface-raised active:bg-surface-raised ${className ?? ""}`}
		{...props}
	/>
));

EditorIconButton.displayName = "EditorIconButton";
