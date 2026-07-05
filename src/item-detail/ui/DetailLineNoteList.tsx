import type { FC } from "react";
import { cn } from "~/ui/cn";

export const DetailLineNoteList: FC<{
	items: readonly string[];
	title: string;
	tone?: "good" | "warn" | "neutral";
}> = ({ items, title, tone = "neutral" }) => {
	if (items.length === 0) return null;

	return (
		<div
			className={cn(
				"rounded-sm px-2.5 py-2 text-xs",
				tone === "good" && "bg-emerald-400/12 text-emerald-50",
				tone === "warn" && "bg-rose-400/14 text-rose-50",
				tone === "neutral" && "bg-violet-300/10",
			)}
		>
			<p className="font-black text-ak-text">{title}</p>
			<ul className="mt-1 space-y-1 leading-5 text-ak-text-muted">
				{items.map((item, index) => (
					<li
						key={`${title}:${index}:${item}`}
						className="break-words"
					>
						{item}
					</li>
				))}
			</ul>
		</div>
	);
};
