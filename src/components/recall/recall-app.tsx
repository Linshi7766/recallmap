"use client";

import { useLearningSession } from "@/hooks/use-learning-session";
import { DiagnosisStage } from "./diagnosis-stage";
import { Progress } from "./progress";
import { RepairStage } from "./repair-stage";
import { ResultStage } from "./result-stage";
import { StartStage } from "./start-stage";
import { TeachbackStage } from "./teachback-stage";

type RecallAppProps = {
  providerLabel?: string;
};

export function RecallApp({
  providerLabel = "Configured by the server",
}: RecallAppProps) {
  const learning = useLearningSession();
  const { session } = learning;
  const hasDiagnosis = session.diagnosis !== null && session.probe !== null;
  const cannotRenderStage =
    (session.stage === "teachback" && session.challenge === null) ||
    (["diagnosis", "repair", "result"].includes(session.stage) &&
      !hasDiagnosis) ||
    (session.stage === "result" && session.repair === null);

  return (
    <main className="shell">
      <header className="app-header">
        <span className="brand">RECALL</span>
        <span className="privacy-note">Progress saved in this browser</span>
      </header>
      <div className="focus-card">
        <Progress stage={session.stage} />
        {session.stage === "start" ? (
          <StartStage
            ready={learning.hydrated}
            busy={learning.busy}
            error={learning.error}
            hasExistingLesson={session.challenge !== null}
            onStart={learning.start}
            onResume={learning.resume}
          />
        ) : null}
        {session.stage === "teachback" && session.challenge ? (
          <TeachbackStage
            challenge={session.challenge}
            firstExplanation={session.firstExplanation}
            busy={learning.busy}
            error={learning.error}
            onChange={learning.changeFirstExplanation}
            onAnalyze={learning.analyze}
            onBack={learning.back}
          />
        ) : null}
        {session.stage === "diagnosis" && session.diagnosis && session.probe ? (
          <DiagnosisStage
            diagnosis={session.diagnosis}
            probe={session.probe}
            onContinue={learning.beginRepair}
            onBack={learning.back}
          />
        ) : null}
        {session.stage === "repair" && session.diagnosis && session.probe ? (
          <RepairStage
            diagnosis={session.diagnosis}
            probe={session.probe}
            firstExplanation={session.firstExplanation}
            revisedExplanation={session.revisedExplanation}
            busy={learning.busy}
            error={learning.error}
            onChange={learning.changeRevisedExplanation}
            onVerify={learning.verify}
            onBack={learning.back}
          />
        ) : null}
        {session.stage === "result" &&
        session.diagnosis &&
        session.probe &&
        session.repair ? (
          <ResultStage
            diagnosis={session.diagnosis}
            repair={session.repair}
            onReview={learning.reviewReasoning}
            onReset={learning.reset}
          />
        ) : null}
        {cannotRenderStage ? (
          <section className="stage stage-guard" role="alert">
            <p className="eyebrow">SESSION RECOVERY</p>
            <h1>This step could not be restored.</h1>
            <p>
              The saved lesson is missing information needed for this view.
              Return to the start to continue safely.
            </p>
            <button type="button" onClick={learning.reset}>
              Return to start
            </button>
          </section>
        ) : null}
      </div>
      <p className="provider-note">AI provider: {providerLabel}</p>
    </main>
  );
}
