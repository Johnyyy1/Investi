/** The expected refusal when Portfolio Lab is not open for this learner; any other error from the unlock check is a failure. */
export class PortfolioLabLockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PortfolioLabLockedError";
  }
}
