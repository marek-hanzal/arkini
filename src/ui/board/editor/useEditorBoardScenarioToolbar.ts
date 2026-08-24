import { useAtomSet } from "@effect/atom-react";
import { useEffect, useMemo, useState } from "react";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import type { EditorBoardGame } from "~/bridge/editor/board/EditorBoardGame";
import { EditorBoardScenarioCommandAtoms } from "~/bridge/editor/board/EditorBoardScenarioCommandAtoms";
import type { EditorBoardScenarioDescriptorSchema } from "~/editor/board/EditorBoardScenarioSchema";

export const editorBoardScenarioDraftOptionId = "editor-board-scenario:draft";

const nextScenarioName = (
	scenarios: ReadonlyArray<{
		readonly name: string;
	}>,
) => {
	const names = new Set(scenarios.map(({ name }) => name));
	let index = 1;
	while (names.has(`Scenario ${index}`)) index += 1;
	return `Scenario ${index}`;
};

const sortScenarios = (scenarios: ReadonlyArray<EditorBoardScenarioDescriptorSchema.Type>) =>
	[
		...scenarios,
	].sort(
		(left, right) =>
			right.updatedAtMs - left.updatedAtMs || left.name.localeCompare(right.name),
	);

const errorMessage = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));

/** Owns the selector draft and every explicit scenario persistence command. */
export const useEditorBoardScenarioToolbar = ({
	game,
	project,
}: {
	readonly game?: EditorBoardGame;
	readonly project: EditorProject;
}) => {
	const list = useAtomSet(EditorBoardScenarioCommandAtoms.list(project.projectId), {
		mode: "promise",
	});
	const save = useAtomSet(EditorBoardScenarioCommandAtoms.save, {
		mode: "promise",
	});
	const restore = useAtomSet(EditorBoardScenarioCommandAtoms.restore, {
		mode: "promise",
	});
	const remove = useAtomSet(EditorBoardScenarioCommandAtoms.remove(project.projectId), {
		mode: "promise",
	});
	const [scenarios, setScenarios] = useState<
		ReadonlyArray<EditorBoardScenarioDescriptorSchema.Type>
	>([]);
	const [name, setName] = useState("Scenario 1");
	const [draft, setDraft] = useState(true);
	const [pending, setPending] = useState(false);
	const [message, setMessage] = useState("Scenarios are saved only when you press Save.");

	useEffect(() => {
		let active = true;
		setPending(true);
		void list(undefined)
			.then((loaded) => {
				if (!active) return;
				const sorted = sortScenarios(loaded);
				setScenarios(sorted);
				setName(nextScenarioName(sorted));
				setDraft(true);
				setMessage("Scenarios are saved only when you press Save.");
			})
			.catch((cause) => {
				if (active) setMessage(errorMessage(cause));
			})
			.finally(() => {
				if (active) setPending(false);
			});
		return () => {
			active = false;
		};
	}, [
		list,
		project.revision,
	]);

	const options = useMemo(
		() => [
			...(draft
				? [
						{
							id: editorBoardScenarioDraftOptionId,
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

	const createDraft = () => {
		setName(nextScenarioName(scenarios));
		setDraft(true);
		setMessage("New slot prepared. Press Save to persist the current Board state.");
	};
	const selectScenario = async (value: string) => {
		if (value === editorBoardScenarioDraftOptionId || pending) return;
		setName(value);
		setDraft(false);
		setPending(true);
		setMessage(`Restoring ${value}…`);
		try {
			const result = await restore({
				project,
				name: value,
			});
			if (result.type === "restored") {
				setMessage(`${value} restored.`);
				return;
			}
			const remaining = scenarios.filter((scenario) => scenario.name !== value);
			setScenarios(remaining);
			setName(nextScenarioName(remaining));
			setDraft(true);
			setMessage(`${value} was invalid and has been deleted. ${result.reason}`);
		} catch (cause) {
			setMessage(errorMessage(cause));
		} finally {
			setPending(false);
		}
	};
	const saveScenario = async () => {
		const normalizedName = name.trim();
		if (game === undefined || normalizedName.length === 0 || pending) return;
		if (draft && scenarios.some((scenario) => scenario.name === normalizedName)) {
			setMessage(`${normalizedName} already exists. Select it to overwrite that scenario.`);
			return;
		}
		setPending(true);
		setMessage(`Saving ${normalizedName}…`);
		try {
			const written = await save({
				game,
				project,
				name: normalizedName,
			});
			setScenarios((current) =>
				sortScenarios([
					written,
					...current.filter((scenario) => scenario.name !== written.name),
				]),
			);
			setName(written.name);
			setDraft(false);
			setMessage(`${written.name} saved.`);
		} catch (cause) {
			setMessage(errorMessage(cause));
		} finally {
			setPending(false);
		}
	};
	const deleteScenario = async () => {
		if (draft || pending) return;
		setPending(true);
		setMessage(`Deleting ${name}…`);
		try {
			await remove(name);
			const remaining = scenarios.filter((scenario) => scenario.name !== name);
			setScenarios(remaining);
			setName(nextScenarioName(remaining));
			setDraft(true);
			setMessage("Scenario deleted. The current Board state is still live and unsaved.");
		} catch (cause) {
			setMessage(errorMessage(cause));
		} finally {
			setPending(false);
		}
	};

	return {
		canSave: game !== undefined && name.trim().length > 0 && !pending,
		createDraft,
		deleteScenario,
		draft,
		message,
		options,
		pending,
		saveScenario,
		selectScenario,
		setName,
		value: draft ? editorBoardScenarioDraftOptionId : name,
	};
};
