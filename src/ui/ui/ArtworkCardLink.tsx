import { createLink } from "@tanstack/react-router";
import { forwardRef, type AnchorHTMLAttributes, type ReactNode } from "react";
import { twMerge } from "tailwind-merge";

interface ArtworkCardProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
	readonly artwork: ReactNode;
	readonly label: string;
	readonly description?: string;
	readonly "data-ui"?: string;
}

const ArtworkCardAnchor = forwardRef<HTMLAnchorElement, ArtworkCardProps>(
	({ artwork, className, description, label, ...props }, ref) => (
		<a
			{...props}
			ref={ref}
			data-ui={props["data-ui"] ?? "ArtworkCardLink"}
			className={twMerge(
				"group grid min-h-0 min-w-0 grid-rows-[minmax(12rem,1fr)_auto] cursor-pointer overflow-hidden rounded-xl border-l-2 border-line-strong bg-surface-raised/60 text-left text-foreground transition-colors hover:bg-surface-raised",
				className,
			)}
		>
			<span className="grid min-h-48 place-items-center overflow-hidden p-4">{artwork}</span>
			<span className="min-w-0 px-3 py-2.5">
				<span className="block truncate font-semibold">{label}</span>
				{description === undefined ? null : (
					<span className="mt-1 block truncate text-xs text-subtle">{description}</span>
				)}
			</span>
		</a>
	),
);

/** Shares artwork-first catalog cards while callers own their destination and image source. */
export const ArtworkCardLink = createLink(ArtworkCardAnchor);
