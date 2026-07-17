import type { Diagnosis, RepairResult } from "@/lib/domain/contracts";
import { ReasoningMap } from "./reasoning-map";

const RESULT_COPY = {
  repaired: { heading: "Understanding repaired", tone: "success" },
  partial: { heading: "A key gap is smaller", tone: "warning" },
  not_repaired: { heading: "This gap still needs work", tone: "danger" },
} as const;

const RESULT_DETAIL: Record<RepairResult["overallStatus"], string> = {
  repaired:
    "The revised explanation now resolves the priority gap against the source material.",
  partial:
    "The revision improves the reasoning, but one important condition remains incomplete.",
  not_repaired:
    "The revised explanation does not yet resolve the priority gap in the source material.",
};

type ResultStageProps = {
  diagnosis: Diagnosis;
  repair: RepairResult;
  onReview: () => void;
  onReset: () => void;
};

export function ResultStage({
  diagnosis,
  repair,
  onReview,
  onReset,
}: ResultStageProps) {
  const copy = RESULT_COPY[repair.overallStatus];
  const updatedDiagnosis: Diagnosis = {
    nodes: repair.nodes,
    priorityNodeId: diagnosis.priorityNodeId,
  };

  return (
    <section
      className="stage result-stage"
      data-tone={copy.tone}
      aria-labelledby="result-heading"
    >
      <p className="eyebrow">VERIFICATION</p>
      <h1 id="result-heading">{copy.heading}</h1>
      <p className="stage-intro">{RESULT_DETAIL[repair.overallStatus]}</p>

      <div className="result-map">
        <h2>Updated reasoning map</h2>
        <ReasoningMap diagnosis={updatedDiagnosis} showChanges />
      </div>

      <article className="before-after" aria-labelledby="comparison-heading">
        <h2 id="comparison-heading">Before → After</h2>
        <div>
          <section>
            <h3>Before</h3>
            <p>{repair.before}</p>
          </section>
          <section>
            <h3>After</h3>
            <p>{repair.after}</p>
          </section>
        </div>
      </article>

      <aside className="recall-card" aria-labelledby="recall-card-heading">
        <p className="card-label">KEEP THIS</p>
        <h2 id="recall-card-heading">Recall card</h2>
        <p>{repair.recallCard}</p>
      </aside>

      <div className="stage-actions result-actions">
        <button
          type="button"
          className="secondary-button"
          onClick={onReview}
        >
          Review my reasoning
        </button>
        <button type="button" onClick={onReset}>
          Try another concept
        </button>
      </div>
    </section>
  );
}
