import type { Diagnosis, Probe } from "@/lib/domain/contracts";

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
  const showLengthError = count > 0 && count < 80;
  const isTransfer = diagnosis.priorityNodeId === null;

  return (
    <section
      className="stage repair-stage"
      aria-labelledby="repair-heading"
      aria-busy={busy}
    >
      <p className="eyebrow">REBUILD THE LINK</p>
      <h1 id="repair-heading">Revise the explanation in your own words</h1>
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
          <span aria-live="polite">{count.toLocaleString()} / 4,000</span>
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
        >
          {count === 0
            ? "Use 80–4,000 characters so the conceptual change is clear."
            : count < 80
              ? `${80 - count} more characters needed`
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
          className="secondary-button"
          disabled={busy}
          onClick={onBack}
        >
          Back to reasoning map
        </button>
        <button
          type="button"
          disabled={!isValid || busy}
          onClick={onVerify}
        >
          {busy
            ? "Checking the repair…"
            : "Check my repaired understanding"}
        </button>
      </div>
    </section>
  );
}
