import type { ReactNode } from "react";

import { EditorInfoTooltip } from "~/editor-control/ui/EditorInfoTooltip";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";

interface EditorValueLabelProps {
	readonly description?: ReactNode;
	readonly label: string;
	readonly required?: boolean;
}

export const EditorValueLabel = ({
	description,
	label,
	required = false,
}: EditorValueLabelProps) => (
	<span className="flex h-5 min-w-0 items-center gap-1 leading-5">
		<span className="font-semibold text-foreground">{label}</span>
		{required ? <span className="size-1.5 shrink-0 rounded-full bg-accent" /> : null}
		{description === undefined ? null : <EditorInfoTooltip content={description} />}
	</span>
);

/** All field kinds place their control directly below the same label row; feedback owns its gap. */
export const EditorValueField = ({
	as: Root = "label",
	children,
	dataUi = "EditorValueField",
	description,
	error,
	fill = false,
	label,
	labelVisible = true,
	required = false,
}: EditorValueLabelProps & {
	readonly as?: "label" | "div" | "fieldset";
	readonly children: ReactNode;
	readonly dataUi?: string;
	readonly error?: string;
	readonly fill?: boolean;
	readonly labelVisible?: boolean;
}) => {
	const heading = (
		<EditorValueLabel
			description={description}
			label={label}
			required={required}
		/>
	);
	return (
		<Root
			className="grid min-w-0 content-start gap-0 text-sm data-[ui-fill=true]:h-full data-[ui-fill=true]:grid-rows-[auto_minmax(0,1fr)] data-[ui-fill=true]:content-stretch"
			{...readDataUiFn({
				dataUi,
				state: {
					fill,
					// Native inputs own invalid targeting; only grouped choices target the wrapper.
					invalid: Root === "fieldset" ? error !== undefined : undefined,
				},
			})}
		>
			{labelVisible ? Root === "fieldset" ? <legend>{heading}</legend> : heading : null}
			{children}
			{error === undefined ? null : (
				<span className="mt-1.5 text-xs leading-5 text-danger">{error}</span>
			)}
		</Root>
	);
};
