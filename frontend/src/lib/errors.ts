import { ApiError } from "./api";
import { tr } from "./i18n";

/**
 * Turns an unknown thrown value into a localized, user-facing message instead
 * of leaking raw strings like "500 Internal Server Error: ...".
 */
export function describeError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return tr("err.unauthorized");
    if (e.status === 403) return tr("err.forbidden");
    if (e.status === 404) return tr("err.notFound");
    if (e.status === 413) return tr("err.tooLarge");
    if (e.status === 429) return tr("err.rateLimited");
    if (e.status >= 500) return tr("err.server", { status: e.status });
    return tr("err.request", { status: e.status });
  }
  // fetch() rejects with a TypeError on network / CORS failures.
  if (e instanceof TypeError) return tr("err.network");
  if (e instanceof Error && e.message) return e.message;
  return tr("err.unknown");
}
