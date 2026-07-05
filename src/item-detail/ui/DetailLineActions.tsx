import type { FC } from "react";
import type { DetailLineModel } from "~/item-detail/control/DetailLineModel";
import { UiButton } from "~/ui/UiButton";
import { UiProgressButton } from "~/ui/UiProgressButton";
import { cn } from "~/ui/cn";

const DetailPrimaryActionLabel: FC<{
	label: string;
	metaLabel?: string;
}> = ({ label, metaLabel }) => (
	<span className="flex min-w-0 items-center justify-center gap-2">
		<span className="min-w-0 truncate">{label}</span>
		{metaLabel ? (
			<span className="shrink-0 text-xs font-black leading-none text-white/85">
				{metaLabel}
			</span>
		) : null}
	</span>
);

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
			<DetailPrimaryActionLabel
				label={control.primaryAction.label}
				metaLabel={control.primaryAction.metaLabel}
			/>
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
