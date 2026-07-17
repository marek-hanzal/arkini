import { createLink, type LinkComponent } from "@tanstack/react-router";
import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes } from "react";

const PrimaryButtonClassName =
	"inline-flex min-h-11 items-center justify-center rounded-lg bg-accent px-5 py-2.5 text-center font-semibold text-accent-contrast transition-colors hover:bg-accent-hover active:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:cursor-wait disabled:opacity-60 aria-disabled:pointer-events-none aria-disabled:opacity-60";

const withPrimaryButtonClassName = (className: string | undefined) =>
	className === undefined ? PrimaryButtonClassName : `${PrimaryButtonClassName} ${className}`;

export type PrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

/** Renders the canonical primary action on a native button. */
export const PrimaryButton = forwardRef<HTMLButtonElement, PrimaryButtonProps>(
	({ className, type = "button", ...props }, ref) => (
		<button
			ref={ref}
			type={type}
			className={withPrimaryButtonClassName(className)}
			{...props}
		/>
	),
);
PrimaryButton.displayName = "PrimaryButton";

type PrimaryButtonAnchorProps = AnchorHTMLAttributes<HTMLAnchorElement>;

const PrimaryButtonAnchor = forwardRef<HTMLAnchorElement, PrimaryButtonAnchorProps>(
	({ className, ...props }, ref) => (
		<a
			ref={ref}
			className={withPrimaryButtonClassName(className)}
			{...props}
		/>
	),
);
PrimaryButtonAnchor.displayName = "PrimaryButtonAnchor";

const CreatedPrimaryButtonLink = createLink(PrimaryButtonAnchor);

/** Renders the canonical primary action with TanStack Router Link semantics and typing. */
export const PrimaryButtonLink: LinkComponent<typeof PrimaryButtonAnchor> = (props) => (
	<CreatedPrimaryButtonLink
		preload="intent"
		{...props}
	/>
);
