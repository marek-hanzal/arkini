import { EditorInfoTooltip } from "~/editor-control/ui/EditorInfoTooltip";

interface EditorFormSectionDividerProps {
	readonly description?: string;
	readonly title: string;
	readonly variant?: "primary" | "secondary";
}

/** Names the following form section while preserving its visual boundary. */
export const EditorFormSectionDivider = ({
	description,
	title,
	variant = "primary",
}: EditorFormSectionDividerProps) => {
	const primary = variant === "primary";
	return (
		<header
			className={`flex min-w-0 items-center gap-3 ${primary ? "my-[clamp(-1rem,-1.375cqmin,-0.25rem)] py-1" : "py-0.5"}`}
			data-ui="EditorFormSectionDivider"
			data-variant={variant}
		>
			<div className="flex shrink-0 items-center gap-1">
				{primary ? (
					<h2 className="text-base font-semibold">{title}</h2>
				) : (
					<h3 className="text-sm font-semibold">{title}</h3>
				)}
				{description === undefined ? null : <EditorInfoTooltip content={description} />}
			</div>
			<span
				className={
					primary
						? "min-w-0 flex-1 border-t border-line-strong"
						: "min-w-0 flex-1 border-t border-line"
				}
			/>
		</header>
	);
};
