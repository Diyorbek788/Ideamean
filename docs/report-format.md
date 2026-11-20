# Report format and privacy

## Input and scope

The tool reads stopped Chromium NetLog JSON captures with an `events` array. A numeric event type ID is decoded against `constants.logEventTypes` in that capture. Expanded string event names can also be processed. Numeric phase IDs follow `constants.logEventPhase` when present and follow Chromium’s default IDs when absent.

Network activity comes from event names. DNS covers `HOST_RESOLVER_` and `DNS_`, TCP covers `TCP_`, TLS covers `SSL_`, `TLS_` and `CERT_VERIFIER_`, QUIC includes `QUIC_` and `HTTP3_`, HTTP covers `HTTP_` and `HTTP2_`, and request activity covers `URL_REQUEST_` and `REQUEST_ALIVE`. The tool counts remaining event records in `other`. An error can be observed in more than one layer.

## Summary fields

| Field | Definition |
| --- | --- |
| `schema` | Report contract identifier `netlog-brief/v1` |
| `kind` | `summary` for one capture or `comparison` for two captures |
| `totals.inputEvents`, `events`, `skipped` | Input rows, counted event records, and rows with an invalid or missing event type |
| `totals.unmappedTypeIds` | Counted records with a numeric type absent from the capture dictionary |
| `totals.errorEvents`, `cancelled`, `pending` | Negative integer `params.net_error` observations. Events with Chromium codes −3 and −1 have their own counters, respectively. |
| `errors` | Counts by fixed Chromium error labels. Other negative integer codes are grouped under `OTHER_NET_ERROR`. |
| `layers` | Event record counts and error observations by layer |
| `http` | HTTP status class counts from the first status line of regular or early-hints response header events at the transaction layer |
| `totals.responseHeaders`, `unreadableStatus` | Supported HTTP header event count and number of those events with a missing or unreadable status line |
| `timings` | Sample count, p50 and p95 in milliseconds, open begins, unmatched ends, and invalid timing observations per operation |

Timing spans use matching BEGIN/END events with the same source ID and event name in input order. The parser pairs a nested END with the closest unmatched BEGIN. It records DNS lookup, TCP connect, TLS handshake, and HTTP header read spans for the supported event types. Each percentile uses the nearest-rank method. Empty timing samples have `null` percentiles. Both successful and failed completed spans may contribute. An invalid source ID or timestamp, or a backwards span, is reflected in coverage.

A comparison includes the summaries as `a` and `b`. The fields in `delta` are B minus A, with a missing error treated as zero and a p95 delta set to `null` if either sample is empty. Counts should be interpreted alongside what was reproduced and the duration and coverage of each run.

See Chromium’s [NetLog format](https://www.chromium.org/developers/design-documents/network-stack/netlog/), [event definitions](https://chromium.googlesource.com/chromium/src/+/main/net/log/net_log_event_type_list.h), and [error codes](https://chromium.googlesource.com/chromium/src/+/main/net/base/net_error_list.h).

## File handling

The browser runs from one local HTML file. Its content security policy permits only its bundled code and styles and blocks network connections. It keeps summaries in tab memory and exports through a local download. The CLI reads local files or stdin and writes a report only to stdout.

The outputs contain fixed report fields without raw capture strings or unrecognized keys. Totals, error categories and timing distributions may still reveal details about a system or experiment, so review a report before sharing it. A maintainer who needs packet or request-level details may need a separate private handoff.
