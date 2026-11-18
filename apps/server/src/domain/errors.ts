// Errors the inner layers raise; the interface layer maps them to HTTP and MCP answers.

/** The visitor's input cannot be accepted (bad URL, private address, wrong scheme). */
export class ValidationError extends Error {
  override name = "ValidationError";
}

/** Too much work is already queued; try again later. */
export class ServiceBusyError extends Error {
  override name = "ServiceBusyError";
}
