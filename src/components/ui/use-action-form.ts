"use client";

import { startTransition, useActionState, type FormEvent } from "react";

/**
 * Runs a Server Action from a form without React's automatic form reset, so that
 * values the user typed survive a validation error. The form still posts natively
 * (via `action`) when JavaScript is unavailable.
 */
export function useActionForm<S>(serverAction: (prev: S | null, formData: FormData) => Promise<S>) {
  const [state, dispatch, pending] = useActionState<S | null, FormData>(serverAction, null);
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const formData = new FormData(event.currentTarget, submitter);
    startTransition(() => dispatch(formData));
  };
  return { state, pending, formProps: { action: dispatch, onSubmit } };
}
