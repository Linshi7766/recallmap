export type StructuredModelErrorCode =
  | "MODEL_UNAVAILABLE"
  | "MODEL_OUTPUT_INVALID"
  | "MODEL_REFUSED";

export class StructuredModelError extends Error {
  readonly code: StructuredModelErrorCode;

  constructor(code: StructuredModelErrorCode, cause?: unknown) {
    super(code, cause === undefined ? undefined : { cause });
    this.name = "StructuredModelError";
    this.code = code;
  }
}

export class ModelUnavailableError extends StructuredModelError {
  constructor(cause?: unknown) {
    super("MODEL_UNAVAILABLE", cause);
    this.name = "ModelUnavailableError";
  }
}
