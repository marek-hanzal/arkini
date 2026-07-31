import {
	createContext,
	useCallback,
	useContext,
	useLayoutEffect,
	useState,
	type PropsWithChildren,
} from "react";

export interface EditorFormActions {
	readonly discard: () => void;
	readonly error?: unknown;
	readonly isDirty: boolean;
	readonly isSaving: boolean;
	readonly save: () => Promise<void>;
}

type RegisterEditorFormActions = (actions: EditorFormActions) => () => void;

const EditorFormActionsContext = createContext<EditorFormActions | undefined>(undefined);
const RegisterEditorFormActionsContext = createContext<
	RegisterEditorFormActions | undefined
>(undefined);

/** Owns only the active form command surface, never its editable values. */
export const EditorFormActionsProvider = ({ children }: PropsWithChildren) => {
	const [actions, setActions] = useState<EditorFormActions>();
	const register = useCallback<RegisterEditorFormActions>((next) => {
		setActions(next);
		return () => {
			setActions((current) => (current === next ? undefined : current));
		};
	}, []);
	return (
		<RegisterEditorFormActionsContext value={register}>
			<EditorFormActionsContext value={actions}>
				{children}
			</EditorFormActionsContext>
		</RegisterEditorFormActionsContext>
	);
};

/** Reads the active local form controls from the editor shell. */
export const useEditorFormActions = () => useContext(EditorFormActionsContext);

/** Publishes a form's command surface while the form route remains mounted. */
export const useRegisterEditorFormActions = (actions: EditorFormActions) => {
	const register = useContext(RegisterEditorFormActionsContext);
	if (register === undefined) {
		throw new Error("Editor form actions require EditorFormActionsProvider.");
	}
	useLayoutEffect(() => register(actions), [
		actions,
		register,
	]);
};
