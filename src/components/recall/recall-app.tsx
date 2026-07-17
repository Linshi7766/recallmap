"use client";

import { useLearningSession } from "@/hooks/use-learning-session";
import { Progress } from "./progress";
import { StartStage } from "./start-stage";
import { TeachbackStage } from "./teachback-stage";

export function RecallApp() {
  const learning = useLearningSession();
  const { session } = learning;

  return (
    <main className="shell">
      <header className="app-header">
        <span className="brand">RECALL</span>
        <span className="privacy-note">Private to this browser</span>
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
        {session.stage !== "start" && session.stage !== "teachback" ? (
          <section className="stage stage-placeholder" aria-live="polite">
            <p className="eyebrow">ANALYSIS READY</p>
            <h1>Your reasoning map is ready for the next step.</h1>
          </section>
        ) : null}
      </div>
    </main>
  );
}
