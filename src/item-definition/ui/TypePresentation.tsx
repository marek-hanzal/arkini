import {
	Backpack,
	Box,
	Factory,
	Hammer,
	MapPinned,
	Mountain,
	PackageOpen,
	ScrollText,
	Timer,
	type LucideIcon,
} from "lucide-react";

import type { TypeSchema } from "~/item-definition/schema/TypeSchema";
import { useTranslator } from "~/translation/ui/useTranslator";

const presentations = {
	blueprint: {
		icon: ScrollText,
	},
	craft: {
		icon: Hammer,
	},
	deposit: {
		icon: Mountain,
	},
	inventory: {
		icon: Backpack,
	},
	producer: {
		icon: Factory,
	},
	simple: {
		icon: Box,
	},
	space: {
		icon: MapPinned,
	},
	stash: {
		icon: PackageOpen,
	},
	temporary: {
		icon: Timer,
	},
} as const satisfies Record<
	TypeSchema.Type,
	{
		readonly icon: LucideIcon;
	}
>;

/** Presents one item type through the shared label, icon, and description source. */
export const TypePresentation = ({
	describe = false,
	type,
}: {
	readonly describe?: boolean;
	readonly type: TypeSchema.Type;
}) => {
	const translator = useTranslator();
	const presentation = presentations[type];
	const Icon = presentation.icon;
	return (
		<span className="flex min-w-0 items-center gap-3">
			<Icon className="size-6 shrink-0 text-accent" />
			<span className="min-w-0">
				<span className="block font-semibold text-foreground">
					{translator.textFn(`Item type - ${type}`)}
				</span>
				{describe ? (
					<span className="mt-1 block text-xs font-normal leading-5 text-muted">
						{translator.textFn(`Item type description - ${type}`)}
					</span>
				) : null}
			</span>
		</span>
	);
};
