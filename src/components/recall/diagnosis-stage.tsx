import type { Diagnosis, Probe } from "@/lib/domain/contracts";
import { ReasoningMap } from "./reasoning-map";

type DiagnosisStageProps = {
  diagnosis: Diagnosis;
  probe: Probe;
  onContinue: () => void;
  onBack: () => void;
};

export function DiagnosisStage({
  diagnosis,
  probe,
  onContinue,
  onBack,
}: DiagnosisStageProps) {
  const isTransfer = diagnosis.priorityNodeId === null;

  return (
    <section
      className="stage diagnosis-stage"
      aria-labelledby="diagnosis-heading"
    >
      <p className="eyebrow">REASONING MAP</p>
      <h1 id="diagnosis-heading">
        {isTransfer ? "No clear misconception found" : "One link needs attention"}
      </h1>
      <p className="stage-intro">
        {isTransfer
          ? "Your explanation is supported by the material. Test whether the idea transfers to a new situation."
          : "The map separates what the material supports from the link that needs another pass."}
      </p>

      <ReasoningMap diagnosis={diagnosis} />

      <article className="probe-card" aria-labelledby="probe-heading">
        <p className="probe-label">
          {isTransfer ? "Transfer question" : "Challenge for the gap"}
        </p>
        <h2 id="probe-heading">{probe.question}</h2>
        <p>Work it through before rewriting your explanation.</p>
      </article>

      <div className="stage-actions">
        <button
          type="button"
          className="secondary-button on-dark"
          onClick={onBack}
        >
          Back to my explanation
        </button>
        <button type="button" onClick={onContinue}>
          Work through this challenge
        </button>
      </div>
    </section>
  );
}
