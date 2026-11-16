"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  Check,
  Download,
  Eye,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  RefreshCw,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import "./admin.css";

type GuestResponse = {
  id: string;
  fullName: string;
  email: string;
  attendance: "yes" | "no";
  guestCount: number;
  companions: { name: string; dietary: string }[];
  dietary: string;
  message: string;
  createdAt: string;
  updatedAt: string;
};

type PageStatus = "loading" | "login" | "dashboard" | "unconfigured" | "error";
type ModalState = {
  kind: "details" | "delete";
  response: GuestResponse;
} | null;

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body) headers.set("Content-Type", "application/json");
  const response = await fetch(path, {
    ...options,
    headers,
    credentials: "same-origin",
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok)
    throw new ApiError(
      data.error || "Something went wrong. Please try again.",
      response.status,
    );
  return data as T;
}

function messageFor(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}

function wasAborted(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Skopje",
  }).format(date);
}

function exportCsv(responses: GuestResponse[]) {
  const rows: string[][] = [
    [
      "Response ID",
      "RSVP name",
      "Email",
      "Attendance",
      "Guest",
      "Dietary requirements",
      "Message",
      "Last response",
    ],
  ];
  for (const response of responses) {
    rows.push([
      response.id,
      response.fullName,
      response.email,
      response.attendance === "yes" ? "Attending" : "Declined",
      response.fullName,
      response.dietary,
      response.message,
      response.updatedAt,
    ]);
    for (const companion of response.companions) {
      rows.push([
        response.id,
        response.fullName,
        response.email,
        "Attending",
        companion.name,
        companion.dietary,
        "",
        response.updatedAt,
      ]);
    }
  }
  const escapeCell = (value: string) => {
    const safeValue = /^[\t\r\n]|^\s*[=+\-@]/.test(value) ? `'${value}` : value;
    return `"${safeValue.replaceAll('"', '""')}"`;
  };
  const csv =
    "\uFEFF" + rows.map((row) => row.map(escapeCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `wedding-guests-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="admin-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="admin-dialog-inner">
        <div className="admin-dialog-heading">
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            className="admin-icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

export default function AdminPage() {
  const [status, setStatus] = useState<PageStatus>("loading");
  const [responses, setResponses] = useState<GuestResponse[]>([]);
  const [responsesLoaded, setResponsesLoaded] = useState(false);
  const [loadingResponses, setLoadingResponses] = useState(false);
  const [error, setError] = useState("");
  const [loginError, setLoginError] = useState("");
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [modal, setModal] = useState<ModalState>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const loadResponses = useCallback(async (signal?: AbortSignal) => {
    setLoadingResponses(true);
    setError("");
    try {
      const data = await api<{ responses: GuestResponse[] }>(
        "/api/admin/responses",
        { signal },
      );
      setResponses(data.responses);
      setResponsesLoaded(true);
    } catch (failure) {
      if (wasAborted(failure)) return;
      if (failure instanceof ApiError && failure.status === 401) {
        setStatus("login");
        setLoginError("Your session has expired. Please sign in again.");
      } else {
        setError(messageFor(failure));
      }
    } finally {
      if (!signal?.aborted) setLoadingResponses(false);
    }
  }, []);

  const initialize = useCallback(
    async (signal?: AbortSignal) => {
      setStatus("loading");
      setError("");
      try {
        const session = await api<{
          configured: boolean;
          authenticated: boolean;
        }>("/api/admin/session", { signal });
        if (!session.configured) {
          setStatus("unconfigured");
        } else if (session.authenticated) {
          setStatus("dashboard");
          await loadResponses(signal);
        } else {
          setStatus("login");
        }
      } catch (failure) {
        if (wasAborted(failure)) return;
        setError(messageFor(failure));
        setStatus("error");
      }
    },
    [loadResponses],
  );

  useEffect(() => {
    const controller = new AbortController();
    void initialize(controller.signal);
    return () => controller.abort();
  }, [initialize]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSigningIn(true);
    setLoginError("");
    try {
      await api("/api/admin/session", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      setPassword("");
      setStatus("dashboard");
      await loadResponses();
    } catch (failure) {
      setLoginError(messageFor(failure));
    } finally {
      setSigningIn(false);
    }
  }

  async function signOut() {
    setError("");
    try {
      await api("/api/admin/session", { method: "DELETE" });
      setResponses([]);
      setResponsesLoaded(false);
      setModal(null);
      setStatus("login");
    } catch (failure) {
      setError(messageFor(failure));
    }
  }

  async function deleteResponse() {
    if (!modal || modal.kind !== "delete") return;
    const id = modal.response.id;
    setDeleting(true);
    setDeleteError("");
    try {
      await api("/api/admin/responses", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      });
      setResponses((current) =>
        current.filter((response) => response.id !== id),
      );
      setModal(null);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 404) {
        setResponses((current) =>
          current.filter((response) => response.id !== id),
        );
        setModal(null);
      } else if (failure instanceof ApiError && failure.status === 401) {
        setModal(null);
        setStatus("login");
        setLoginError("Your session has expired. Please sign in again.");
      } else {
        setDeleteError(messageFor(failure));
      }
    } finally {
      setDeleting(false);
    }
  }

  const accepted = responses.filter(
    (response) => response.attendance === "yes",
  );
  const attendingGuests = accepted.reduce(
    (total, response) => total + response.guestCount,
    0,
  );
  const declined = responses.filter(
    (response) => response.attendance === "no",
  ).length;
  const query = search.trim().toLocaleLowerCase();
  const visibleResponses = responses.filter(
    (response) =>
      (filter === "all" || response.attendance === filter) &&
      (!query ||
        response.fullName.toLocaleLowerCase().includes(query) ||
        response.email.toLocaleLowerCase().includes(query)),
  );

  return (
    <main className="admin-page">
      <header className="admin-header">
        <a className="admin-back-link" href="/">
          <ArrowLeft size={17} />
          <span>Invitation</span>
        </a>
        <span className="admin-header-name">Wedding guest book</span>
        {status === "dashboard" ? (
          <button className="admin-text-button" onClick={() => void signOut()}>
            <LogOut size={16} />
            <span>Sign out</span>
          </button>
        ) : (
          <span className="admin-header-spacer" />
        )}
      </header>

      {status === "loading" && (
        <div className="admin-centered" role="status">
          <LoaderCircle className="admin-spinner" size={25} />
          <p>Opening your guest book…</p>
        </div>
      )}

      {status === "login" && (
        <section className="admin-login-section">
          <div className="admin-login-mark">
            <LockKeyhole size={24} strokeWidth={1.4} />
          </div>
          <p className="admin-eyebrow">For the hosts</p>
          <h1>
            A little planning,
            <br />
            <em>a lot of love.</em>
          </h1>
          <p className="admin-login-description">
            Sign in to see who’s joining your celebration.
          </p>
          <form
            className="admin-login-form"
            onSubmit={(event) => void signIn(event)}
          >
            <label htmlFor="admin-password">Password</label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              disabled={signingIn}
              autoFocus
            />
            {loginError && (
              <p className="admin-error" role="alert">
                {loginError}
              </p>
            )}
            <button
              className="admin-button admin-primary"
              type="submit"
              disabled={signingIn}
            >
              {signingIn ? (
                <>
                  <LoaderCircle className="admin-spinner" size={17} />
                  Signing in…
                </>
              ) : (
                "Open guest book"
              )}
            </button>
          </form>
        </section>
      )}

      {status === "unconfigured" && (
        <section className="admin-setup admin-centered">
          <LockKeyhole size={28} strokeWidth={1.4} />
          <h1>Set up your guest book</h1>
          <p>
            Add an <code>ADMIN_PASSWORD</code> server secret with at least 12
            characters, then refresh this page to sign in.
          </p>
          <button className="admin-button" onClick={() => void initialize()}>
            <RefreshCw size={16} />
            Check setup
          </button>
        </section>
      )}

      {status === "error" && (
        <section className="admin-centered admin-setup">
          <h1>We couldn’t open the guest book</h1>
          <p className="admin-error" role="alert">
            {error}
          </p>
          <button className="admin-button" onClick={() => void initialize()}>
            <RefreshCw size={16} />
            Try again
          </button>
        </section>
      )}

      {status === "dashboard" && (
        <div className="admin-content">
          <div className="admin-page-title">
            <div>
              <p className="admin-eyebrow">The people who make it special</p>
              <h1>Your guest list</h1>
            </div>
            <button
              className="admin-button"
              onClick={() => exportCsv(responses)}
              disabled={!responses.length}
              title="Export all guest responses"
            >
              <Download size={16} />
              Export CSV
            </button>
          </div>

          <div className="admin-stats" aria-label="Guest response totals">
            <div className="admin-stat">
              <span>
                <Users size={17} />
                Attending guests
              </span>
              <strong>{responsesLoaded ? attendingGuests : "—"}</strong>
              <small>including companions</small>
            </div>
            <div className="admin-stat">
              <span>
                <Check size={17} />
                Accepted invitations
              </span>
              <strong>{responsesLoaded ? accepted.length : "—"}</strong>
              <small>responses saying yes</small>
            </div>
            <div className="admin-stat">
              <span>
                <X size={17} />
                Declined invitations
              </span>
              <strong>{responsesLoaded ? declined : "—"}</strong>
              <small>responses saying no</small>
            </div>
          </div>

          <section className="admin-responses" aria-label="RSVP responses">
            <div className="admin-toolbar">
              <label className="admin-search">
                <Search size={17} />
                <span className="admin-sr-only">Search by name or email</span>
                <input
                  type="search"
                  placeholder="Search by name or email"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
              <label className="admin-filter">
                <span className="admin-sr-only">Filter attendance</span>
                <select
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                >
                  <option value="all">All responses</option>
                  <option value="yes">Attending</option>
                  <option value="no">Declined</option>
                </select>
              </label>
              <button
                type="button"
                className="admin-icon-button admin-refresh"
                aria-label="Refresh responses"
                disabled={loadingResponses}
                onClick={() => void loadResponses()}
              >
                <RefreshCw
                  size={17}
                  className={loadingResponses ? "admin-spinner" : ""}
                />
              </button>
            </div>

            {error && (
              <div className="admin-list-error" role="alert">
                <span>{error}</span>
                <button
                  className="admin-text-button"
                  onClick={() => void loadResponses()}
                >
                  Try again
                </button>
              </div>
            )}

            {loadingResponses && !responses.length ? (
              <div className="admin-empty" role="status">
                <LoaderCircle className="admin-spinner" size={23} />
                <p>Gathering your replies…</p>
              </div>
            ) : visibleResponses.length ? (
              <>
                <div className="admin-list-heading" aria-hidden="true">
                  <span>Guest</span>
                  <span>Attendance</span>
                  <span>Party</span>
                  <span>Latest reply</span>
                  <span />
                </div>
                <ul className="admin-guest-list">
                  {visibleResponses.map((response) => (
                    <li className="admin-guest-row" key={response.id}>
                      <button
                        className="admin-guest-name"
                        onClick={() => setModal({ kind: "details", response })}
                      >
                        <strong>{response.fullName}</strong>
                        <span>{response.email || "Email not provided"}</span>
                      </button>
                      <span
                        className={`admin-attendance admin-attendance-${response.attendance}`}
                      >
                        {response.attendance === "yes" ? (
                          <Check size={13} />
                        ) : (
                          <X size={13} />
                        )}
                        {response.attendance === "yes"
                          ? "Attending"
                          : "Declined"}
                      </span>
                      <span className="admin-party">
                        <Users size={15} />
                        {response.guestCount}
                      </span>
                      <time
                        className="admin-reply-date"
                        dateTime={response.updatedAt}
                      >
                        {formatDate(response.updatedAt)}
                      </time>
                      <div className="admin-row-actions">
                        <button
                          className="admin-icon-button"
                          aria-label={`View ${response.fullName}’s response`}
                          onClick={() =>
                            setModal({ kind: "details", response })
                          }
                        >
                          <Eye size={17} />
                        </button>
                        <button
                          className="admin-icon-button admin-delete-icon"
                          aria-label={`Delete ${response.fullName}’s response`}
                          onClick={() => {
                            setDeleteError("");
                            setModal({ kind: "delete", response });
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="admin-list-count">
                  {visibleResponses.length} of {responses.length}{" "}
                  {responses.length === 1 ? "response" : "responses"}
                </p>
              </>
            ) : (
              !error && (
                <div className="admin-empty">
                  <Users size={29} strokeWidth={1.25} />
                  <h2>
                    {search || filter !== "all"
                      ? "No matching replies"
                      : "The first yes is on its way"}
                  </h2>
                  <p>
                    {search || filter !== "all"
                      ? "Try another name or attendance filter."
                      : "Guest responses will appear here as invitations are answered."}
                  </p>
                </div>
              )
            )}
          </section>
        </div>
      )}

      {modal?.kind === "details" && (
        <Dialog title={modal.response.fullName} onClose={() => setModal(null)}>
          <span
            className={`admin-attendance admin-attendance-${modal.response.attendance}`}
          >
            {modal.response.attendance === "yes" ? "Attending" : "Declined"}
          </span>
          {modal.response.email && (
            <a
              className="admin-detail-email"
              href={`mailto:${modal.response.email}`}
            >
              {modal.response.email}
            </a>
          )}
          {modal.response.attendance === "yes" && (
            <section className="admin-detail-section">
              <h3>
                {modal.response.guestCount === 1
                  ? "Guest"
                  : `Party of ${modal.response.guestCount}`}
              </h3>
              <ul className="admin-party-details">
                {[
                  {
                    name: modal.response.fullName,
                    dietary: modal.response.dietary,
                  },
                  ...modal.response.companions,
                ].map((guest, index) => (
                  <li key={index}>
                    <strong>{guest.name}</strong>
                    <span>
                      {guest.dietary || "No dietary requirements shared"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {modal.response.message && (
            <section className="admin-detail-section">
              <h3>Message</h3>
              <p className="admin-message">{modal.response.message}</p>
            </section>
          )}
          <p className="admin-detail-date">
            Received {formatDate(modal.response.createdAt)}
            {modal.response.updatedAt !== modal.response.createdAt && (
              <>
                <br />
                Updated {formatDate(modal.response.updatedAt)}
              </>
            )}
          </p>
        </Dialog>
      )}

      {modal?.kind === "delete" && (
        <Dialog title="Remove this RSVP?" onClose={() => setModal(null)}>
          <p className="admin-delete-description">
            This removes <strong>{modal.response.fullName}</strong>’s response
            and their party from your guest list.
          </p>
          {deleteError && (
            <p className="admin-error" role="alert">
              {deleteError}
            </p>
          )}
          <div className="admin-dialog-actions">
            <button
              className="admin-button"
              disabled={deleting}
              onClick={() => setModal(null)}
            >
              Keep response
            </button>
            <button
              className="admin-button admin-danger"
              disabled={deleting}
              onClick={() => void deleteResponse()}
            >
              {deleting ? (
                <>
                  <LoaderCircle className="admin-spinner" size={16} />
                  Deleting…
                </>
              ) : (
                "Delete response"
              )}
            </button>
          </div>
        </Dialog>
      )}
    </main>
  );
}
