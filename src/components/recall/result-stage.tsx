import type { Diagnosis, RepairResult } from "@/lib/domain/contracts";
import { ReasoningMap } from "./reasoning-map";
import { StageHeading } from "./stage-heading";

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

const TRANSFER_COPY = {
  repaired: { heading: "Transfer confirmed", tone: "success" },
  partial: { heading: "Transfer is taking shape", tone: "warning" },
  not_repaired: { heading: "Transfer needs another pass", tone: "danger" },
} as const;

const TRANSFER_DETAIL: Record<RepairResult["overallStatus"], string> = {
  repaired:
    "The revised explanation applies the supported idea accurately in the new situation.",
  partial:
    "The new situation is handled more clearly, but one condition remains incomplete.",
  not_repaired:
    "The new situation still needs an explanation supported by the study material.",
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
  const isTransfer = diagnosis.priorityNodeId === null;
  const copy = (isTransfer ? TRANSFER_COPY : RESULT_COPY)[repair.overallStatus];
  const detail = (isTransfer ? TRANSFER_DETAIL : RESULT_DETAIL)[
    repair.overallStatus
  ];
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
      <StageHeading id="result-heading">{copy.heading}</StageHeading>
      <p className="stage-intro">{detail}</p>

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

      {repair.overallStatus === "repaired" && repair.recallCard ? (
        <aside className="recall-card" aria-labelledby="recall-card-heading">
          <p className="card-label">KEEP THIS</p>
          <h2 id="recall-card-heading">Recall card</h2>
          <p>{repair.recallCard}</p>
        </aside>
      ) : null}

      <div className="result-map">
        <h2 id="updated-reasoning-map-heading">Updated reasoning map</h2>
        <ReasoningMap
          diagnosis={updatedDiagnosis}
          ariaLabelledBy="updated-reasoning-map-heading"
          showChanges
        />
      </div>

      <div className="stage-actions result-actions">
        <button type="button" onClick={onReset}>
          Try another concept
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={onReview}
        >
          Review my reasoning
        </button>
      </div>
    </section>
  );
}
