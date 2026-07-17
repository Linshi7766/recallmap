import type { LearningStage } from "@/lib/domain/session";

const STEPS = ["Choose", "Teach Back", "Challenge", "Verify"] as const;

const CURRENT_STEP: Record<LearningStage, (typeof STEPS)[number]> = {
  start: "Choose",
  teachback: "Teach Back",
  diagnosis: "Challenge",
  repair: "Challenge",
  result: "Verify",
};

export function Progress({ stage }: { stage: LearningStage }) {
  const current = CURRENT_STEP[stage];

  return (
    <nav className="progress" aria-label="Lesson progress">
      <ol>
        {STEPS.map((step, index) => (
          <li key={step} aria-current={step === current ? "step" : undefined}>
            <span aria-hidden="true">{index + 1}</span>
            {step}
          </li>
        ))}
      </ol>
    </nav>
  );
}
