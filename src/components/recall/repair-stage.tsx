import type { Diagnosis, Probe } from "@/lib/domain/contracts";
import { StageHeading } from "./stage-heading";

type RepairStageProps = {
  diagnosis: Diagnosis;
  probe: Probe;
  firstExplanation: string;
  revisedExplanation: string;
  busy: boolean;
  error: string | null;
  onChange: (value: string) => void;
  onVerify: () => void;
  onBack: () => void;
};

export function RepairStage({
  diagnosis,
  probe,
  firstExplanation,
  revisedExplanation,
  busy,
  error,
  onChange,
  onVerify,
  onBack,
}: RepairStageProps) {
  const count = revisedExplanation.length;
  const isValid = count >= 80 && count <= 4_000;
  const showLengthError = count > 0 && !isValid;
  const isTransfer = diagnosis.priorityNodeId === null;

  return (
    <section
      className="stage repair-stage"
      aria-labelledby="repair-heading"
      aria-busy={busy}
    >
      <p className="eyebrow">REBUILD THE LINK</p>
      <StageHeading id="repair-heading">
        Revise the explanation in your own words
      </StageHeading>
      <p className="stage-intro">
        Respond to the question directly, then reconnect it to the original
        concept.
      </p>

      <article className="probe-card repair-probe" aria-labelledby="repair-probe-heading">
        <p className="probe-label">
          {isTransfer ? "Transfer question" : "Challenge for the gap"}
        </p>
        <h2 id="repair-probe-heading">{probe.question}</h2>
      </article>

      <details className="original-answer">
        <summary>Original answer</summary>
        <p>{firstExplanation}</p>
      </details>

      <div className="field repair-field">
        <div className="label-row">
          <label htmlFor="revised-explanation">Revised explanation</label>
          <span>{count.toLocaleString()} / 4,000</span>
        </div>
        <textarea
          id="revised-explanation"
          rows={9}
          minLength={80}
          maxLength={4_000}
          value={revisedExplanation}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={showLengthError}
          aria-describedby="repair-guidance"
          disabled={busy}
        />
        <p
          id="repair-guidance"
          className={showLengthError ? "field-error" : "field-hint"}
          role="status"
        >
          {count === 0
            ? "Use 80–4,000 characters so the conceptual change is clear."
            : count < 80
              ? "At least 80 characters required"
              : count > 4_000
                ? `${count - 4_000} ${count - 4_000 === 1 ? "character" : "characters"} over the 4,000 limit`
                : "Ready to compare with your first explanation"}
        </p>
      </div>

      {error ? (
        <div className="error-banner" role="alert">
          <p>{error}</p>
          <button type="button" disabled={busy} onClick={onVerify}>
            {busy ? "Retrying verification…" : "Retry verification"}
          </button>
        </div>
      ) : null}

      <div className="stage-actions">
        <button
          type="button"
          disabled={!isValid || busy}
          onClick={onVerify}
        >
          {busy
            ? "Checking the repair…"
            : "Check my repaired understanding"}
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={busy}
          onClick={onBack}
        >
          Back to reasoning map
        </button>
      </div>
    </section>
  );
}
