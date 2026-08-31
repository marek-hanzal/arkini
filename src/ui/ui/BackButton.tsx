import { ArrowLeft } from "lucide-react";
import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { twMerge } from "tailwind-merge";
import { PrimaryButton } from "~/ui/ui/Button";

type BackButtonProps = ComponentPropsWithoutRef<typeof PrimaryButton>;

/** Renders the canonical primary back action with its shared directional cue. */
export const BackButton = forwardRef<HTMLButtonElement, BackButtonProps>(
	({ children = "Back", className, ...props }, ref) => (
		<PrimaryButton
			ref={ref}
			className={twMerge("mx-auto gap-2", className)}
			{...props}
		>
			<ArrowLeft className="size-4" />
			{children}
		</PrimaryButton>
	),
);

BackButton.displayName = "BackButton";
