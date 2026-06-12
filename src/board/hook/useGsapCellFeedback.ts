import { useEffect, useRef, type RefObject } from "react";
import { playCellError, playCellSuccess } from "~/play/util/animation";

export namespace useGsapCellFeedback {
  export interface Props {
    invalid: boolean;
    success: boolean;
  }
}

export function useGsapCellFeedback<TElement extends HTMLElement>(ref: RefObject<TElement | null>, { invalid, success }: Readonly<useGsapCellFeedback.Props>) {
  const wasInvalidRef = useRef(false);
  const wasSuccessRef = useRef(success);
  const didMountSuccessRef = useRef(false);

  useEffect(() => {
    const element = ref.current;
    if (element && invalid && !wasInvalidRef.current) playCellError(element);
    wasInvalidRef.current = invalid;
  }, [invalid, ref]);

  useEffect(() => {
    const element = ref.current;

    if (!didMountSuccessRef.current) {
      didMountSuccessRef.current = true;
      wasSuccessRef.current = success;
      return;
    }

    if (element && success && !wasSuccessRef.current) playCellSuccess(element);
    wasSuccessRef.current = success;
  }, [success, ref]);
}
