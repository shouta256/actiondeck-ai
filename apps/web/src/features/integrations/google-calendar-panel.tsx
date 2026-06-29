"use client";

import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { listUpcomingCalendarEvents } from "@/features/calendar-events/api";
import type { CalendarEvent } from "@/features/calendar-events/types";

import {
  getGoogleCalendarStatus,
  startGoogleCalendarOAuth,
  syncGoogleCalendar,
} from "./api";
import type {
  GoogleCalendarConnectionStatus,
  GoogleCalendarSyncResult,
} from "./types";

function formatDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

function formatEventTimeRange(event: CalendarEvent) {
  const start = new Date(event.start);
  const end = new Date(event.end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "-";
  }

  const date = new Intl.DateTimeFormat(undefined, {
    month: "2-digit",
    day: "2-digit",
    timeZoneName: "short",
  }).format(start);
  const time = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${date} ${time.format(start)}-${time.format(end)}`;
}

function formatSource(source: string) {
  if (source === "google_calendar") {
    return "Google";
  }
  if (source === "local_seed") {
    return "Seed";
  }
  return source;
}

function Field({
  label,
  value,
}: {
  label: string;
  value: string | number | boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 text-sm">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="min-w-0 break-words text-right font-medium text-neutral-950">
        {String(value)}
      </dd>
    </div>
  );
}

export function GoogleCalendarPanel() {
  const [status, setStatus] = useState<GoogleCalendarConnectionStatus | null>(
    null,
  );
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [syncResult, setSyncResult] = useState<GoogleCalendarSyncResult | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      try {
        setStatus(await getGoogleCalendarStatus());
      } catch {
        setStatus(null);
      }
      try {
        setCalendarEvents(await listUpcomingCalendarEvents(5));
      } catch {
        setCalendarEvents([]);
      }
    });
  }, []);

  function handleConnect() {
    setErrorMessage(null);
    startTransition(async () => {
      try {
        const result = await startGoogleCalendarOAuth();
        window.location.href = result.authorization_url;
      } catch {
        setErrorMessage("Google Calendar connection failed.");
      }
    });
  }

  function handleSync() {
    setErrorMessage(null);
    startTransition(async () => {
      try {
        const nextSyncResult = await syncGoogleCalendar();
        setSyncResult(nextSyncResult);
        setStatus(await getGoogleCalendarStatus());
        setCalendarEvents(await listUpcomingCalendarEvents(5));
      } catch {
        setErrorMessage("Google Calendar sync failed.");
      }
    });
  }

  const connected = Boolean(status?.connected);

  return (
    <section className="rounded-md border border-neutral-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Google Calendar</h2>
          <p className="mt-1 text-sm leading-5 text-neutral-500">
            Read-onlyで予定を同期し、Safety Checkの衝突判定に使います。
          </p>
        </div>
        <span className="rounded border border-neutral-200 bg-neutral-50 px-2 py-1 font-mono text-[11px] text-neutral-600">
          {connected ? "connected" : "not connected"}
        </span>
      </div>

      <dl className="mt-4 divide-y divide-neutral-100">
        <Field label="Scope" value={status?.scopes[0] ?? "-"} />
        <Field label="Expires" value={formatDateTime(status?.expires_at)} />
        <Field label="Updated" value={formatDateTime(status?.updated_at)} />
      </dl>

      <div className="mt-4 grid gap-2">
        <Button
          className="w-full justify-center rounded-md"
          disabled={isPending}
          onClick={handleConnect}
          type="button"
          variant="outline"
        >
          {connected ? "Reconnect" : "Connect"}
        </Button>
        <Button
          className="w-full justify-center rounded-md"
          disabled={isPending || !connected}
          onClick={handleSync}
          type="button"
          variant="outline"
        >
          {isPending ? "Working" : "Sync"}
        </Button>
      </div>

      {syncResult ? (
        <div className="mt-4 border-t border-neutral-100 pt-4">
          <h3 className="text-xs font-semibold text-neutral-700">Last Sync</h3>
          <dl className="mt-2 divide-y divide-neutral-100">
            <Field label="Calendar" value={syncResult.calendar_id} />
            <Field label="Events" value={syncResult.synced_count} />
            <Field label="From" value={formatDateTime(syncResult.time_min)} />
            <Field label="To" value={formatDateTime(syncResult.time_max)} />
          </dl>
        </div>
      ) : null}

      <div className="mt-4 border-t border-neutral-100 pt-4">
        <h3 className="text-xs font-semibold text-neutral-700">
          Upcoming Events
        </h3>
        {calendarEvents.length > 0 ? (
          <ul className="mt-3 divide-y divide-neutral-100">
            {calendarEvents.map((event) => (
              <li className="py-3" key={event.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-neutral-950">
                      {event.title}
                    </p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {formatEventTimeRange(event)}
                    </p>
                    {event.location ? (
                      <p className="mt-1 truncate text-xs text-neutral-500">
                        {event.location}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 rounded border border-neutral-200 bg-neutral-50 px-2 py-1 font-mono text-[11px] text-neutral-600">
                    {formatSource(event.source)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm leading-5 text-neutral-500">
            同期済みの予定はまだありません。
          </p>
        )}
      </div>

      {errorMessage ? (
        <p className="mt-3 text-sm text-red-700">{errorMessage}</p>
      ) : null}
    </section>
  );
}
