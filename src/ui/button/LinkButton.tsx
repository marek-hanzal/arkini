import { forwardRef, type ButtonHTMLAttributes } from "react";
import { twMerge } from "tailwind-merge";

import { CursorClassName, type CursorSemantic } from "~/ui/cursor/CursorSemantic";

type LinkButtonCursorIntent = Extract<
	CursorSemantic,
	"not-allowed" | "pointer" | "progress" | "wait"
>;

export interface LinkButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	readonly cursorIntent?: LinkButtonCursorIntent;
}

/** Renders a native button with the canonical inline-link affordance. */
export const LinkButton = forwardRef<HTMLButtonElement, LinkButtonProps>(
	({ className, cursorIntent = "pointer", disabled, type = "button", ...props }, ref) => (
		<button
			ref={ref}
			type={type}
			disabled={disabled}
			className={twMerge(
				"inline border-0 bg-transparent p-0 font-medium text-accent underline decoration-accent/55 underline-offset-2 transition-colors hover:text-accent-hover disabled:text-muted disabled:no-underline",
				CursorClassName[
					disabled && cursorIntent !== "progress" && cursorIntent !== "wait"
						? "not-allowed"
						: cursorIntent
				],
				className,
			)}
			{...props}
		/>
	),
);
LinkButton.displayName = "LinkButton";
