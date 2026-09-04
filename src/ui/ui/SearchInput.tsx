import { X } from "lucide-react";
import { forwardRef, type InputHTMLAttributes } from "react";
import { twMerge } from "tailwind-merge";

interface SearchInputProps
	extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "type" | "value"> {
	readonly containerClassName?: string;
	readonly onValueChangeFn: (value: string) => void;
	readonly value: string;
}

/** Renders the canonical search field with one consistent clear action. */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
	({ className, containerClassName, onValueChangeFn, value, ...props }, ref) => (
		<span className={twMerge("relative block min-w-0", containerClassName)}>
			<input
				{...props}
				ref={ref}
				type="search"
				value={value}
				className={twMerge(className, "ak-search-input pr-12")}
				onChange={(event) => onValueChangeFn(event.currentTarget.value)}
			/>
			{value.length === 0 ? null : (
				<button
					type="button"
					className="absolute inset-y-0 right-0 grid w-12 cursor-pointer place-items-center rounded-r-lg border-y border-r border-transparent text-muted hover:border-line-strong hover:bg-surface-raised hover:text-foreground"
					title="Clear search"
					onMouseDown={(event) => event.preventDefault()}
					onClick={() => onValueChangeFn("")}
				>
					<X className="size-5" />
				</button>
			)}
		</span>
	),
);

SearchInput.displayName = "SearchInput";
