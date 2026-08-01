import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { twMerge } from "tailwind-merge";
import { PrimaryButton } from "~/ui/button/Button";

type BackButtonProps = ComponentPropsWithoutRef<typeof PrimaryButton>;

/** Renders the canonical primary back action with its shared directional cue. */
export const BackButton = forwardRef<HTMLButtonElement, BackButtonProps>(
	({ children = "Back", className, ...props }, ref) => (
		<PrimaryButton
			ref={ref}
			className={twMerge("mx-auto gap-2", className)}
			{...props}
		>
			<span
				className="icon-[lucide--arrow-left] size-4"
				aria-hidden="true"
			/>
			{children}
		</PrimaryButton>
	),
);

BackButton.displayName = "BackButton";
