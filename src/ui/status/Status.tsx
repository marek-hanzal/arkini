import type { ReactNode } from "react";

export namespace Status {
	export interface Props {
		readonly action?: ReactNode;
		readonly dataUi?: string;
		readonly description: string;
		readonly icon: string;
		readonly title: string;
	}
}

/** Presents one deliberate empty or unavailable product state with an optional canonical action. */
export const Status = ({
	action,
	dataUi = "Status",
	description,
	icon,
	title,
}: Status.Props) => (
	<section
		className="grid min-h-48 place-items-center rounded-2xl border border-line bg-surface/70 p-[var(--ak-panel-padding)] text-center"
		data-ui={dataUi}
	>
		<div className="grid max-w-md justify-items-center gap-3">
			<span
				className={`${icon} size-7 text-subtle`}
				aria-hidden="true"
			/>
			<div className="grid gap-1.5">
				<h2 className="text-base font-semibold text-foreground">{title}</h2>
				<p className="text-sm text-muted">{description}</p>
			</div>
			{action === undefined ? null : <div className="pt-1">{action}</div>}
		</div>
	</section>
);
