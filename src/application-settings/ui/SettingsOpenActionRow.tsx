import { Button } from "~/ui/button/Button";

interface SettingsOpenActionRowProps {
	readonly dataUi: string;
	readonly title: string;
	readonly description: string;
	readonly pending: boolean;
	readonly disabled?: boolean;
	readonly idleLabel: string;
	readonly onClick: () => void;
}

/** Settings-only row for a platform-owned directory open action. */
export const SettingsOpenActionRow = ({
	dataUi,
	title,
	description,
	pending,
	disabled = false,
	idleLabel,
	onClick,
}: SettingsOpenActionRowProps) => (
	<div
		className="ak-list-row flex items-center justify-between gap-4 rounded-lg border border-line px-4 py-3"
		data-ui={dataUi}
	>
		<span className="grid gap-1">
			<span className="text-sm font-semibold text-foreground">{title}</span>
			<span className="text-sm leading-5 text-muted">{description}</span>
		</span>
		<Button
			className="shrink-0"
			cursorIntent={pending ? "progress" : undefined}
			disabled={pending || disabled}
			onClick={onClick}
		>
			{idleLabel}
		</Button>
	</div>
);
