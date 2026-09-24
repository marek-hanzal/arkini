/** Highlights the actual mnemonic; the owning control supplies its selected visual state. */
export const ShortcutLabel = ({
	label,
	shortcut,
}: {
	readonly label: string;
	readonly shortcut?: string;
}) => {
	const index =
		shortcut?.length === 1
			? label.toLocaleLowerCase().indexOf(shortcut.toLocaleLowerCase())
			: -1;
	return (
		<span>
			{index < 0 ? (
				label
			) : (
				<>
					{label.slice(0, index)}
					<span className="text-accent group-data-[ui-selected=true]/shortcut:text-inherit">
						{label[index]}
					</span>
					{label.slice(index + 1)}
				</>
			)}
		</span>
	);
};
