# NetLog Brief

[O‘zbekcha](README.uz.md) · MIT · v0.1.0

**Turn two Chromium NetLog captures into a bug report without uploading the captures.** Use A for a baseline and B for a failing run, a different Chromium browser, or a different network. The comparison reports DNS, TCP, TLS, QUIC and HTTP activity, network errors, response status classes, and operation timing.

Maintainers can read the Markdown in a GitHub issue. Tools can consume the same evidence as versioned JSON. The browser and command line use the same parser.

## Try the example

Download [index.html](index.html) and open it in Chrome or Edge. It starts with two clearly labeled synthetic captures. Use **Findings** to inspect the error counts, **Timing & coverage** to see timing sample sizes and incomplete records, and **Save Markdown** to export the comparison. The file works offline and includes English and Uzbek.

| Observation | A | B |
| --- | ---: | ---: |
| `ERR_QUIC_PROTOCOL_ERROR` records | 2 | 0 |
| `ERR_CONNECTION_TIMED_OUT` records | 1 | 0 |
| HTTP 2xx status lines | 1 | 3 |
| DNS lookup p95 | 14 ms | 14 ms |

Two error records in the example represent observations of one QUIC failure at different points. Read the [rendered example report](examples/comparison.md).

## Compare your own captures

1. Open `chrome://net-export` or `edge://net-export`. Keep the default privacy mode.
2. Start logging, perform the action in another tab, stop logging, then save the JSON. Load it as A.
3. Repeat the same action under the second condition and load that JSON as B. Keep the runs short and comparable. With one file the app shows a single-capture summary.
4. Review the exported report before attaching it to a public issue. Include the reproduction steps, what changed between A and B, and the actual browser behavior in the issue body.

Each input may contain up to 32 MiB and 250,000 event records. Shorter runs also reduce unrelated browser traffic in the report. [Chromium NetLog capture guide](https://www.chromium.org/for-testers/providing-network-details/)

## Command line

Clone this repository. The CLI requires Node.js 22 or newer and has zero third-party runtime dependencies.

```sh
node bin/netlog-brief.mjs summarize examples/demo-a.json --format json
node bin/netlog-brief.mjs compare examples/demo-a.json examples/demo-b.json > comparison.md
node bin/netlog-brief.mjs compare examples/demo-a.json examples/demo-b.json --lang uz
```

Use `-` once to read a capture from stdin. The tool writes the report to stdout and uses exit code 1 for input or read errors and 2 for command usage errors. A successfully parsed capture returns 0 even if the capture contains network errors.

## What a report contains

The tools use a fixed set of labels and emit counts and relative timing statistics. They omit URLs, hostnames, IP addresses, headers, credentials, filenames, source IDs, absolute timestamps, and payloads. They read the first eligible response status line to compute a status class.

NetLog records activity from the entire browser capture. Retries, redirects, reused connections, cache hits, and other tabs can affect counts. Treat timings as descriptive statistics for observed operation spans and use sample counts when interpreting a delta. For field definitions, coverage and boundaries, see [Report format and privacy](docs/report-format.md). The [Chromium NetLog format](https://www.chromium.org/developers/design-documents/network-stack/netlog/) describes the upstream event model.

## Develop and contribute

```sh
npm test
npm run build
npm run check:build
```

The generated `index.html` bundles the parser, report generator, interface and synthetic examples. Open it from disk for a local demo. See [contributing](CONTRIBUTING.md) for a Chromium loopback check and the steps for sharing a compatibility case.

NetLog Brief is an independent tool for people reporting and maintaining browser and web projects.
