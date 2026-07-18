import type { Challenge } from "@/lib/domain/contracts";
import { StageHeading } from "./stage-heading";

type TeachbackStageProps = {
  challenge: Challenge;
  firstExplanation: string;
  busy: boolean;
  error: string | null;
  onChange: (value: string) => void;
  onAnalyze: () => void;
  onBack: () => void;
};

export function TeachbackStage({
  challenge,
  firstExplanation,
  busy,
  error,
  onChange,
  onAnalyze,
  onBack,
}: TeachbackStageProps) {
  const count = firstExplanation.length;
  const isValid = count >= 80 && count <= 4_000;

  return (
    <section className="stage teachback-stage" aria-labelledby="prompt-heading">
      <p className="eyebrow">TEACH IT BACK</p>
      <p className="concept">{challenge.concept}</p>
      <StageHeading id="prompt-heading">{challenge.prompt}</StageHeading>
      <p className="stage-intro">
        Explain it in your own words. RecallMap will look at the reasoning, not
        polish or vocabulary.
      </p>

      <div className="field answer-field">
        <div className="label-row">
          <label htmlFor="first-explanation">Your explanation</label>
          <span aria-live="polite">{count.toLocaleString()} / 4,000</span>
        </div>
        <textarea
          id="first-explanation"
          rows={10}
          value={firstExplanation}
          maxLength={4_000}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby="answer-guidance"
          disabled={busy}
        />
        <p id="answer-guidance" className="field-hint">
          {count < 80
            ? `${80 - count} more characters needed`
            : "Enough detail to reveal your reasoning"}
        </p>
      </div>

      {error ? (
        <div className="error-banner" role="alert">
          <p>{error}</p>
          <button type="button" disabled={busy} onClick={onAnalyze}>
            {busy ? "Retrying analysis…" : "Retry analysis"}
          </button>
        </div>
      ) : null}

      <div className="stage-actions">
        <button
          type="button"
          disabled={!isValid || busy}
          onClick={onAnalyze}
        >
          {busy ? "Finding the key gap…" : "Reveal my blind spot"}
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={busy}
          onClick={onBack}
        >
          Back
        </button>
      </div>
    </section>
  );
}
