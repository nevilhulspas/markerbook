/** Thrown when a site is not a lab catalogue or looks like a manipulation attempt. Carries a user-facing reason. */
export class ScrapeRejectedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ScrapeRejectedError'
  }
}
