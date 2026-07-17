"use client";

import { useState, type FormEvent } from "react";
import { LessonSourceSchema, type LessonSource } from "@/lib/domain/contracts";
import { normalizeSourceText } from "@/lib/domain/evidence";
import { SAMPLE_LESSON } from "@/lib/domain/sample-lesson";

type StartStageProps = {
  ready: boolean;
  busy: boolean;
  error: string | null;
  hasExistingLesson: boolean;
  onStart: (source: LessonSource) => void;
};

type FormErrors = { title?: string; text?: string };

export function StartStage({
  ready,
  busy,
  error,
  hasExistingLesson,
  onStart,
}: StartStageProps) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [pendingSource, setPendingSource] = useState<LessonSource | null>(null);

  function requestStart(source: LessonSource) {
    if (hasExistingLesson) {
      setPendingSource(source);
      return;
    }
    onStart(source);
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
    requestStart(source);
  }

  return (
    <section className="stage start-stage" aria-labelledby="start-heading">
      <div className="hero-copy">
        <p className="eyebrow">MISCONCEPTION DETECTOR</p>
        <h1 id="start-heading">Can you explain what you think you know?</h1>
        <p className="lede">Teach it back. Recall finds the hidden gap.</p>
      </div>

      {error ? <p className="error-banner" role="alert">{error}</p> : null}

      {pendingSource ? (
        <div
          className="replace-confirmation"
          role="alertdialog"
          aria-labelledby="replace-title"
          aria-describedby="replace-description"
        >
          <div>
            <h2 id="replace-title">Replace your current lesson?</h2>
            <p id="replace-description">
              This clears the explanations and analysis saved for your current
              lesson.
            </p>
          </div>
          <div className="confirmation-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => setPendingSource(null)}
            >
              Keep current lesson
            </button>
            <button
              type="button"
              onClick={() => {
                const source = pendingSource;
                setPendingSource(null);
                onStart(source);
              }}
            >
              Replace current lesson
            </button>
          </div>
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
          type="button"
          disabled={!ready || busy}
          onClick={() => requestStart(SAMPLE_LESSON)}
        >
          {busy ? "Preparing your prompt…" : "Start sample lesson"}
        </button>
      </article>

      <details className="paste-panel">
        <summary>Paste your own material</summary>
        <form onSubmit={submitPasted} noValidate>
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
          <button type="submit" disabled={!ready || busy}>
            {busy ? "Preparing your prompt…" : "Use this material"}
          </button>
        </form>
      </details>
    </section>
  );
}
