import { useCallback, useEffect, useMemo, useState } from "react";
import { useGradeCertificate } from "@/hooks/useGradeCertificate";
import { type GradeCertificateDocument, emptyGradeCertificate } from "@/lib/grade-certificate";

interface DraftState {
  /** What is saved in the database. */
  saved: GradeCertificateDocument;
  draft: GradeCertificateDocument;
}

const isSame = (a: GradeCertificateDocument, b: GradeCertificateDocument) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Working copy of a student's certificate: every edit (typing, syncing) goes to the draft and
 * nothing reaches the database until `save`. `discard` goes back to what is saved.
 * Mount it once per student (key the component by student) so drafts never mix.
 */
export function useGradeCertificateDraft(studentId: string) {
  const { certificate, saveCertificate } = useGradeCertificate(studentId);
  const [state, setState] = useState<DraftState | null>(null);

  // Fresh data replaces the draft only while it has no pending edits.
  useEffect(() => {
    if (!certificate) return;
    setState((prev) => (!prev || isSame(prev.draft, prev.saved) ? { saved: certificate, draft: certificate } : prev));
  }, [certificate]);

  const isDirty = useMemo(() => !!state && !isSame(state.draft, state.saved), [state]);

  // The browser asks before closing or reloading with unsaved changes.
  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  const updateDraft = useCallback(
    (update: (draft: GradeCertificateDocument) => GradeCertificateDocument) =>
      setState((prev) => (prev ? { ...prev, draft: update(prev.draft) } : prev)),
    [],
  );

  const discard = useCallback(() => setState((prev) => (prev ? { ...prev, draft: prev.saved } : prev)), []);

  const save = useCallback(async () => {
    if (!state) return;
    const document = state.draft;
    await saveCertificate.mutateAsync(document);
    setState((prev) => (prev ? { ...prev, saved: document } : prev));
  }, [state, saveCertificate]);

  return {
    draft: state?.draft ?? emptyGradeCertificate(),
    updateDraft,
    isLoading: !state,
    isDirty,
    isSaving: saveCertificate.isPending,
    save,
    discard,
  };
}
