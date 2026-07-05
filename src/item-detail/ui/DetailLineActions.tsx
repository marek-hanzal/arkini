import type { FC } from "react";
import type { DetailLineModel } from "~/item-detail/control/DetailLineModel";
import { UiButton } from "~/ui/UiButton";
import { UiProgressButton } from "~/ui/UiProgressButton";
import { cn } from "~/ui/cn";

export const DetailLineActions: FC<{
	control: DetailLineModel["control"];
}> = ({ control }) => (
	<div className={cn("mt-3 grid gap-2", control.defaultAction && "grid-cols-3")}>
		<UiProgressButton
			disabled={control.primaryAction.disabled}
			progress={control.primaryAction.progress}
			tone={control.primaryAction.tone}
			className={control.defaultAction ? "col-span-2" : undefined}
			onClick={control.primaryAction.onClick}
		>
			{control.primaryAction.label}
		</UiProgressButton>
		{control.defaultAction ? (
			<UiButton
				fullWidth
				disabled={control.defaultAction.disabled}
				tone={control.defaultAction.tone}
				onClick={control.defaultAction.onClick}
			>
				{control.defaultAction.label}
			</UiButton>
		) : null}
	</div>
);
