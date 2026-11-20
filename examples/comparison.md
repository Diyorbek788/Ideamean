# NetLog Brief — Capture comparison

Each count describes events in the whole capture. One failed operation can appear in several events. Differences alone cannot establish a root cause.

## Overview

| Measure | A | B | B − A |
| --- | --- | --- | --- |
| Event records | 24 | 33 | +9 |
| Error observations | 3 | 0 | -3 |
| Response header events | 1 | 3 | +2 |
| Cancelled operations | 0 | 0 | 0 |
| Pending I/O events | 0 | 0 | 0 |

## Network errors

| Chromium error | A | B | B − A |
| --- | --- | --- | --- |
| ERR_QUIC_PROTOCOL_ERROR | 2 | 0 | -2 |
| ERR_CONNECTION_TIMED_OUT | 1 | 0 | -1 |

## HTTP responses

| Status class | A | B | B − A |
| --- | --- | --- | --- |
| 2xx | 1 | 3 | +2 |

## Network activity

Cells show event count / error observations.

| Layer | A | B | Δ errors |
| --- | --- | --- | --- |
| DNS | 6 / 0 | 6 / 0 | 0 |
| TCP | 4 / 1 | 6 / 0 | -1 |
| TLS | 2 / 0 | 6 / 0 | 0 |
| QUIC / HTTP/3 | 3 / 1 | 0 / 0 | -1 |
| HTTP | 3 / 0 | 9 / 0 | 0 |
| URL request | 6 / 1 | 6 / 0 | -1 |
| Other | 0 / 0 | 0 / 0 | 0 |

## Operation timings

Cells show p50 / p95 in milliseconds and the sample count.

| Operation | A | B | Δ p95 (ms) |
| --- | --- | --- | --- |
| DNS lookup | 11 / 14 (n=3) | 11 / 14 (n=3) | 0 |
| TCP connect | 26 / 180 (n=2) | 13 / 14 (n=3) | -166 |
| TLS handshake | 38 / 38 (n=1) | 19 / 20 (n=3) | -18 |
| HTTP header read | 27 / 27 (n=1) | 9 / 10 (n=3) | -17 |

## Capture coverage

| Measure | A | B | B − A |
| --- | --- | --- | --- |
| Malformed rows skipped | 0 | 0 | 0 |
| Unmapped type IDs | 0 | 0 | 0 |
| Unreadable HTTP status | 0 | 0 | 0 |
| Unpaired or invalid timing records | 0 | 0 | 0 |

Only fixed labels, counts and relative timing statistics are included.

Schema: netlog-brief/v1
