"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { LessonSourceSchema, type LessonSource } from "@/lib/domain/contracts";
import { normalizeSourceText } from "@/lib/domain/evidence";
import { SAMPLE_LESSON } from "@/lib/domain/sample-lesson";
import { StageHeading } from "./stage-heading";

type StartStageProps = {
  ready: boolean;
  busy: boolean;
  error: string | null;
  hasExistingLesson: boolean;
  onStart: (source: LessonSource) => void;
  onResume: () => void;
};

type FormErrors = { title?: string; text?: string };
type StartOrigin = "sample" | "pasted";

export function StartStage({
  ready,
  busy,
  error,
  hasExistingLesson,
  onStart,
  onResume,
}: StartStageProps) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [pending, setPending] = useState<{
    source: LessonSource;
    origin: StartOrigin;
  } | null>(null);
  const sampleTriggerRef = useRef<HTMLButtonElement>(null);
  const pastedTriggerRef = useRef<HTMLButtonElement>(null);
  const keepButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (pending) keepButtonRef.current?.focus();
  }, [pending]);

  function triggerFor(origin: StartOrigin) {
    return origin === "sample"
      ? sampleTriggerRef.current
      : pastedTriggerRef.current;
  }

  function closeConfirmation() {
    const origin = pending?.origin;
    setPending(null);
    if (origin) triggerFor(origin)?.focus();
  }

  function requestStart(source: LessonSource, origin: StartOrigin) {
    if (hasExistingLesson) {
      setPending({ source, origin });
      return;
    }
    onStart(source);
  }

  function replacementConfirmation(origin: StartOrigin) {
    if (pending?.origin !== origin) return null;
    return (
      <div
        className="replace-confirmation"
        role="group"
        aria-labelledby={`replace-title-${origin}`}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            closeConfirmation();
          }
        }}
      >
        <div>
          <h2 id={`replace-title-${origin}`}>Replace your current lesson?</h2>
          <p>
            This clears the explanations and analysis saved for your current
            lesson.
          </p>
        </div>
        <div className="confirmation-actions">
          <button
            ref={keepButtonRef}
            type="button"
            className="secondary-button"
            onClick={closeConfirmation}
          >
            Keep current lesson
          </button>
          <button
            type="button"
            onClick={() => {
              const source = pending.source;
              setPending(null);
              onStart(source);
            }}
          >
            Replace current lesson
          </button>
        </div>
      </div>
    );
  }

  function submitPasted(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedTitle = normalizeSourceText(title);
    const normalizedText = normalizeSourceText(text);
    const nextErrors: FormErrors = {};

    if (!normalizedTitle) {
      nextErrors.title = "Add a lesson title.";
    } else if (normalizedTitle.length > 120) {
      nextErrors.title = "Keep the title to 120 characters or fewer.";
    }
    if (normalizedText.length < 240) {
      nextErrors.text = "Paste at least 240 characters of study material.";
    } else if (normalizedText.length > 12_000) {
      nextErrors.text =
        "Paste no more than 12,000 characters—one chapter or section works best.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const source = LessonSourceSchema.parse({
      id: `pasted-${globalThis.crypto.randomUUID()}`,
      kind: "pasted",
      title: normalizedTitle,
      text: normalizedText,
    });
    setErrors({});
    requestStart(source, "pasted");
  }

  return (
    <section className="stage start-stage" aria-labelledby="start-heading">
      <div className="hero-copy">
        <p className="eyebrow">MISCONCEPTION DETECTOR</p>
        <StageHeading id="start-heading">
          Can you explain what you think you know?
        </StageHeading>
        <p className="lede">Teach it back. RecallMap finds the hidden gap.</p>
      </div>

      {error ? <p className="error-banner" role="alert">{error}</p> : null}

      {hasExistingLesson ? (
        <div className="resume-card">
          <div>
            <p className="card-label">IN PROGRESS</p>
            <h2>Pick up where you left off</h2>
          </div>
          <button type="button" disabled={!ready || busy} onClick={onResume}>
            Continue current lesson
          </button>
        </div>
      ) : null}

      <article className="sample-card">
        <div>
          <p className="card-label">READY-TO-TRY LESSON</p>
          <h2>{SAMPLE_LESSON.title}</h2>
          <p>
            Test whether an association tells us what caused it. No account or
            setup needed.
          </p>
        </div>
        <button
          ref={sampleTriggerRef}
          type="button"
          disabled={!ready || busy}
          onClick={() => requestStart(SAMPLE_LESSON, "sample")}
        >
          {busy ? "Preparing your prompt…" : "Start sample lesson"}
        </button>
      </article>
      {replacementConfirmation("sample")}

      <details className="paste-panel">
        <summary>Paste your own material</summary>
        <form onSubmit={submitPasted} noValidate>
          <p className="privacy-disclosure">
            Your content is sent for AI analysis and is not stored in a server
            database.
          </p>
          <div className="field">
            <label htmlFor="lesson-title">Lesson title</label>
            <input
              id="lesson-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              aria-invalid={Boolean(errors.title)}
              aria-describedby={errors.title ? "title-error" : undefined}
            />
            {errors.title ? (
              <p id="title-error" className="field-error">{errors.title}</p>
            ) : null}
          </div>
          <div className="field">
            <div className="label-row">
              <label htmlFor="study-material">Study material</label>
              <span>{text.length.toLocaleString()} / 12,000</span>
            </div>
            <textarea
              id="study-material"
              rows={8}
              value={text}
              onChange={(event) => setText(event.target.value)}
              aria-invalid={Boolean(errors.text)}
              aria-describedby={errors.text ? "material-error" : undefined}
            />
            {errors.text ? (
              <p id="material-error" className="field-error">{errors.text}</p>
            ) : (
              <p className="field-hint">240–12,000 characters</p>
            )}
          </div>
          <button
            ref={pastedTriggerRef}
            type="submit"
            disabled={!ready || busy}
          >
            {busy ? "Preparing your prompt…" : "Use this material"}
          </button>
          {replacementConfirmation("pasted")}
        </form>
      </details>
    </section>
  );
}
