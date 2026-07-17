"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  LearningApiError,
  requestChallenge,
  requestDiagnosis,
  requestRepair,
} from "@/lib/api/learning-client";
import type { LessonSource } from "@/lib/domain/contracts";
import {
  createLearningSession,
  learningSessionReducer,
  restoreSession,
  serializeSession,
  type LearningEvent,
  type LearningSession,
} from "@/lib/domain/session";

const STORAGE_KEY = "recall.session.v1";
const UNKNOWN_ERROR = "Recall encountered an unexpected error. Please try again.";

function errorMessage(error: unknown): string {
  return error instanceof LearningApiError ? error.message : UNKNOWN_ERROR;
}

export function useLearningSession() {
  const [session, setSession] = useState<LearningSession>(() =>
    createLearningSession(globalThis.crypto.randomUUID()),
  );
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef(session);
  const busyRef = useRef(false);
  const hydratedRef = useRef(false);
  const mountedRef = useRef(true);
  const requestGenerationRef = useRef(0);

  const transition = useCallback((event: LearningEvent) => {
    const next = learningSessionReducer(sessionRef.current, event);
    sessionRef.current = next;
    setSession(next);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestGenerationRef.current += 1;
    };
  }, []);

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      let restored: LearningSession | null = null;
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        restored = stored === null ? null : restoreSession(stored);
      } catch {
        // Storage can be unavailable in private or locked-down browser contexts.
      }

      if (restored) {
        sessionRef.current = restored;
        setSession(restored);
      }
      hydratedRef.current = true;
      setHydrated(true);
    }, 0);

    return () => window.clearTimeout(hydrationTimer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, serializeSession(session));
    } catch {
      // The active in-memory session remains usable when persistence is denied.
    }
  }, [hydrated, session]);

  const runExclusive = useCallback(
    async (operation: (isCurrent: () => boolean) => Promise<void>) => {
      if (busyRef.current || !mountedRef.current) return;
      const generation = ++requestGenerationRef.current;
      const isCurrent = () =>
        mountedRef.current && requestGenerationRef.current === generation;
      busyRef.current = true;
      setBusy(true);
      setError(null);

      try {
        await operation(isCurrent);
      } catch (caught) {
        if (isCurrent()) setError(errorMessage(caught));
      } finally {
        if (isCurrent()) {
          busyRef.current = false;
          setBusy(false);
        }
      }
    },
    [],
  );

  const start = useCallback(
    (source: LessonSource) => {
      if (!hydratedRef.current) return;
      void runExclusive(async (isCurrent) => {
        transition({ type: "RESET" });
        transition({ type: "SOURCE_SELECTED", source });
        const challenge = await requestChallenge(sessionRef.current.id, source);
        if (!isCurrent()) return;
        transition({ type: "CHALLENGE_READY", challenge });
      });
    },
    [runExclusive, transition],
  );

  const analyze = useCallback(() => {
    void runExclusive(async (isCurrent) => {
      const current = sessionRef.current;
      if (!current.source || !current.challenge) return;
      const result = await requestDiagnosis(
        current.id,
        current.source,
        current.challenge,
        current.firstExplanation,
      );
      if (!isCurrent()) return;
      transition({ type: "DIAGNOSIS_READY", ...result });
    });
  }, [runExclusive, transition]);

  const verify = useCallback(() => {
    void runExclusive(async (isCurrent) => {
      const current = sessionRef.current;
      if (
        !current.source ||
        !current.challenge ||
        !current.diagnosis ||
        !current.probe
      ) {
        return;
      }
      const repair = await requestRepair(
        current.id,
        current.source,
        current.challenge,
        current.firstExplanation,
        current.diagnosis,
        current.probe,
        current.revisedExplanation,
      );
      if (!isCurrent()) return;
      transition({ type: "REPAIR_READY", repair });
    });
  }, [runExclusive, transition]);

  const back = useCallback(() => {
    if (busyRef.current) return;
    setError(null);
    transition({ type: "BACK" });
  }, [transition]);

  const resume = useCallback(() => {
    if (busyRef.current) return;
    const current = sessionRef.current;
    if (current.stage !== "start" || !current.source || !current.challenge) {
      return;
    }
    setError(null);
    transition({ type: "CHALLENGE_READY", challenge: current.challenge });
  }, [transition]);

  const backToTeachback = useCallback(() => {
    if (busyRef.current) return;
    setError(null);
    let remainingTransitions = 3;
    while (
      sessionRef.current.stage !== "teachback" &&
      sessionRef.current.stage !== "start" &&
      remainingTransitions > 0
    ) {
      transition({ type: "BACK" });
      remainingTransitions -= 1;
    }
  }, [transition]);

  const reset = useCallback(() => {
    if (busyRef.current) return;
    setError(null);
    transition({ type: "RESET" });
  }, [transition]);

  const changeFirstExplanation = useCallback(
    (value: string) => {
      setError(null);
      transition({ type: "FIRST_EXPLANATION_CHANGED", value });
    },
    [transition],
  );

  const changeRevisedExplanation = useCallback(
    (value: string) => {
      setError(null);
      transition({ type: "REVISED_EXPLANATION_CHANGED", value });
    },
    [transition],
  );

  return {
    session,
    hydrated,
    busy,
    error,
    start,
    analyze,
    verify,
    back,
    resume,
    backToTeachback,
    reset,
    changeFirstExplanation,
    changeRevisedExplanation,
  };
}
