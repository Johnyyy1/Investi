#!/usr/bin/env bash
# Every suite signs up from 127.0.0.1, while each one stands for independent learners. Empties the
# per-IP rate-limit windows in the step's disposable DATABASE_URL so a suite never inherits the last one's.
set -euo pipefail
psql "$DATABASE_URL" -qc "delete from rate_limit_bucket"
