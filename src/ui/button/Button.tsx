import { createLink, type LinkComponent } from "@tanstack/react-router";
import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes } from "react";
import { twMerge } from "tailwind-merge";

const ButtonBaseClassName =
	"inline-flex min-h-11 items-center justify-center rounded-lg px-5 py-2.5 text-center font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:pointer-events-none aria-disabled:cursor-not-allowed aria-disabled:opacity-60";

const ButtonVariantClassNames = {
	default:
		"border border-line bg-surface/75 text-foreground shadow-lg backdrop-blur-md hover:border-line-strong hover:bg-surface-raised active:bg-surface-raised",
	primary:
		"bg-accent text-accent-contrast shadow-lg hover:bg-accent-hover active:bg-accent-hover",
	danger: "bg-danger text-danger-contrast shadow-lg hover:opacity-90 active:opacity-80",
} as const;

type ButtonVariant = keyof typeof ButtonVariantClassNames;

const withButtonClassName = (variant: ButtonVariant, className: string | undefined) =>
	twMerge(ButtonBaseClassName, ButtonVariantClassNames[variant], className);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;
export type PrimaryButtonProps = ButtonProps;
export type DangerButtonProps = ButtonProps;

const createButton = (displayName: string, variant: ButtonVariant) => {
	const Component = forwardRef<HTMLButtonElement, ButtonProps>(
		({ className, type = "button", ...props }, ref) => (
			<button
				ref={ref}
				type={type}
				className={withButtonClassName(variant, className)}
				{...props}
			/>
		),
	);
	Component.displayName = displayName;
	return Component;
};

const createButtonAnchor = (displayName: string, variant: ButtonVariant) => {
	const Component = forwardRef<HTMLAnchorElement, AnchorHTMLAttributes<HTMLAnchorElement>>(
		({ className, ...props }, ref) => (
			<a
				ref={ref}
				className={withButtonClassName(variant, className)}
				{...props}
			/>
		),
	);
	Component.displayName = displayName;
	return Component;
};

/** Renders the canonical neutral game action on a native button. */
export const Button = createButton("Button", "default");

/** Renders the canonical primary game action on a native button. */
export const PrimaryButton = createButton("PrimaryButton", "primary");

/** Renders the canonical destructive game action on a native button. */
export const DangerButton = createButton("DangerButton", "danger");

const ButtonAnchor = createButtonAnchor("ButtonAnchor", "default");
const PrimaryButtonAnchor = createButtonAnchor("PrimaryButtonAnchor", "primary");
const DangerButtonAnchor = createButtonAnchor("DangerButtonAnchor", "danger");

const CreatedButtonLink = createLink(ButtonAnchor);
const CreatedPrimaryButtonLink = createLink(PrimaryButtonAnchor);
const CreatedDangerButtonLink = createLink(DangerButtonAnchor);

/** Renders the canonical neutral game action with TanStack Router Link semantics. */
export const ButtonLink: LinkComponent<typeof ButtonAnchor> = (props) => (
	<CreatedButtonLink
		preload="intent"
		{...props}
	/>
);

/** Renders the canonical primary game action with TanStack Router Link semantics. */
export const PrimaryButtonLink: LinkComponent<typeof PrimaryButtonAnchor> = (props) => (
	<CreatedPrimaryButtonLink
		preload="intent"
		{...props}
	/>
);

/** Renders the canonical destructive game action with TanStack Router Link semantics. */
export const DangerButtonLink: LinkComponent<typeof DangerButtonAnchor> = (props) => (
	<CreatedDangerButtonLink
		preload="intent"
		{...props}
	/>
);
