export type ModelOutputValidationCode =
  | "evidence_not_grounded"
  | "repair_invariant_failed";

export class ModelOutputValidationError extends Error {
  readonly feedbackCode: ModelOutputValidationCode;

  constructor(feedbackCode: ModelOutputValidationCode, message: string) {
    super(message);
    this.name = "ModelOutputValidationError";
    this.feedbackCode = feedbackCode;
  }
}
