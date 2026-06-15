import type { FC } from "react";
import { DbStatusCard } from "~/play/ui/DbStatusCard";
import { SheetHeader } from "~/shared/ui/SheetHeader";

export namespace DatabaseSheet {
	export interface Props {
		onClose(): void;
	}
}

export const DatabaseSheet: FC<DatabaseSheet.Props> = ({ onClose }) => (
	<section className="max-h-[var(--ak-sheet-max-height)] overflow-y-auto overscroll-contain">
		<SheetHeader
			eyebrow="System"
			description="Local database"
			onClose={onClose}
		/>
		<div className="p-4 pt-1">
			<DbStatusCard />
		</div>
	</section>
);
