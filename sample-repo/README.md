# CodedoC Sample Repository

A deliberately vulnerable demo repository used by the **TRY SAMPLE REPOSITORY**
button in CodedoC. Running a scan here needs no GitHub connection - the demo
ships this tree locally and shows exactly what a real scan finds.

It contains one intentionally weak Python FastAPI app plus a Python dependency
with known CVEs. **Isolated demo code only - never deploy it.**

## What a scan finds

- **Secrets leak** - a fake OpenAI `sk-...` key (flagged by Gitleaks, redacted
  as `[REDACTED_SECRET]` before it reaches any LLM).
- **Injection risk** - raw SQL built with `f-strings` instead of parameters.
- **Secrets in code** - a DB password hard-coded in the settings module.
- **Outdated dependency** - a Python package with known CVEs in `requirements.txt`.
- **Weak auth** - admin credentials checked against a hard-coded value.

Files:

```text
sample-repo/
├── app/
│   ├── main.py            FastAPI app with an SQL-injection-prone endpoint
│   └── settings.py        hard-coded DB password + fake API key
├── requirements.txt       Python package pinned to a version with known CVEs
└── README.md              this file
```
