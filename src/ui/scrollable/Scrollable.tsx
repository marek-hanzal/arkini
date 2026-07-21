import { forwardRef, type HTMLAttributes } from "react";
import { twMerge } from "tailwind-merge";

/** Provides one constrained overflow owner for content that may exceed its available surface. */
export const Scrollable = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
	({ className, ...props }, ref) => (
		<div
			ref={ref}
			className={twMerge("min-h-0 min-w-0 overflow-auto overscroll-contain", className)}
			data-ui="Scrollable"
			{...props}
		/>
	),
);

Scrollable.displayName = "Scrollable";
