import { useContext } from "react";
import { PlayRootElementContext } from "~/play/context/PlayRootElementContext";

export const usePlayRootElement = () => useContext(PlayRootElementContext);
