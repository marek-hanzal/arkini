import { useAtomSet } from "@effect/atom-react";
import { useEffect, useMemo, useState } from "react";

import type { Project } from "~/project-authoring/type/Project";
import type { EditorBoardGame } from "~/board-scenario/type/EditorBoardGame";
import { BoardScenarioCommandAtoms } from "~/board-scenario/atom/BoardScenarioCommandAtoms";
import type { BoardScenarioDescriptorSchema } from "~/board-scenario/schema/BoardScenarioSchema";

const boardScenarioDraftOptionId = "editor-board-scenario:draft";

const nextScenarioNameFn = (
	scenarios: ReadonlyArray<{
		readonly name: string;
	}>,
) => {
	const names = new Set(scenarios.map(({ name }) => name));
	let index = 1;
	while (names.has(`Scenario ${index}`)) index += 1;
	return `Scenario ${index}`;
};

const sortScenariosFn = (scenarios: ReadonlyArray<BoardScenarioDescriptorSchema.Type>) =>
	[
		...scenarios,
	].sort(
		(left, right) =>
			right.updatedAtMs - left.updatedAtMs || left.name.localeCompare(right.name),
	);

const errorMessageFn = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));

/** Owns the selector draft and every explicit scenario persistence command. */
export const useBoardScenarioToolbar = ({
	game,
	project,
}: {
	readonly game?: EditorBoardGame;
	readonly project: Project;
}) => {
	const listFn = useAtomSet(BoardScenarioCommandAtoms.list(project.projectId), {
		mode: "promise",
	});
	const saveFn = useAtomSet(BoardScenarioCommandAtoms.save, {
		mode: "promise",
	});
	const restoreFn = useAtomSet(BoardScenarioCommandAtoms.restore, {
		mode: "promise",
	});
	const removeFn = useAtomSet(BoardScenarioCommandAtoms.remove(project.projectId), {
		mode: "promise",
	});
	const [scenarios, setScenariosFn] = useState<ReadonlyArray<BoardScenarioDescriptorSchema.Type>>(
		[],
	);
	const [name, setNameFn] = useState("Scenario 1");
	const [draft, setDraftFn] = useState(true);
	const [pending, setPendingFn] = useState(false);
	const [message, setMessageFn] = useState("Scenarios are saved only when you press Save.");

	useEffect(() => {
		let active = true;
		setPendingFn(true);
		void listFn(undefined)
			.then((loaded) => {
				if (!active) return;
				const sorted = sortScenariosFn(loaded);
				setScenariosFn(sorted);
				setNameFn(nextScenarioNameFn(sorted));
				setDraftFn(true);
				setMessageFn("Scenarios are saved only when you press Save.");
			})
			.catch((cause) => {
				if (active) setMessageFn(errorMessageFn(cause));
			})
			.finally(() => {
				if (active) setPendingFn(false);
			});
		return () => {
			active = false;
		};
	}, [
		listFn,
		project.revision,
	]);

	const options = useMemo(
		() => [
			...(draft
				? [
						{
							id: boardScenarioDraftOptionId,
							label: name,
							meta: "Not saved",
							terms: [
								name,
							],
						},
					]
				: []),
			...scenarios.map((scenario) => ({
				id: scenario.name,
				label: scenario.name,
				meta: `Saved for ${scenario.version}`,
				terms: [
					scenario.name,
				],
			})),
		],
		[
			draft,
			name,
			scenarios,
		],
	);

	const createDraftFn = () => {
		setNameFn(nextScenarioNameFn(scenarios));
		setDraftFn(true);
		setMessageFn("New slot prepared. Press Save to persist the current Board state.");
	};
	const selectScenarioFn = async (value: string) => {
		if (value === boardScenarioDraftOptionId || pending) return;
		setNameFn(value);
		setDraftFn(false);
		setPendingFn(true);
		setMessageFn(`Restoring ${value}…`);
		try {
			const result = await restoreFn({
				project,
				name: value,
			});
			if (result.type === "restored") {
				setMessageFn(`${value} restored.`);
				return;
			}
			setMessageFn(`${value} could not be restored. ${result.reason}`);
		} catch (cause) {
			setMessageFn(errorMessageFn(cause));
		} finally {
			setPendingFn(false);
		}
	};
	const saveScenarioFn = async () => {
		const normalizedName = name.trim();
		if (game === undefined || normalizedName.length === 0 || pending) return;
		if (draft && scenarios.some((scenario) => scenario.name === normalizedName)) {
			setMessageFn(`${normalizedName} already exists. Select it to overwrite that scenario.`);
			return;
		}
		setPendingFn(true);
		setMessageFn(`Saving ${normalizedName}…`);
		try {
			const written = await saveFn({
				game,
				project,
				name: normalizedName,
			});
			setScenariosFn((current) =>
				sortScenariosFn([
					written,
					...current.filter((scenario) => scenario.name !== written.name),
				]),
			);
			setNameFn(written.name);
			setDraftFn(false);
			setMessageFn(`${written.name} saved.`);
		} catch (cause) {
			setMessageFn(errorMessageFn(cause));
		} finally {
			setPendingFn(false);
		}
	};
	const deleteScenarioFn = async () => {
		if (draft || pending) return;
		setPendingFn(true);
		setMessageFn(`Deleting ${name}…`);
		try {
			await removeFn(name);
			const remaining = scenarios.filter((scenario) => scenario.name !== name);
			setScenariosFn(remaining);
			setNameFn(nextScenarioNameFn(remaining));
			setDraftFn(true);
			setMessageFn("Scenario deleted. The current Board state is still live and unsaved.");
		} catch (cause) {
			setMessageFn(errorMessageFn(cause));
		} finally {
			setPendingFn(false);
		}
	};

	return {
		canSave: game !== undefined && name.trim().length > 0 && !pending,
		createDraftFn,
		deleteScenarioFn,
		draft,
		message,
		options,
		pending,
		saveScenarioFn,
		selectScenarioFn,
		setNameFn,
		value: draft ? boardScenarioDraftOptionId : name,
	};
};
