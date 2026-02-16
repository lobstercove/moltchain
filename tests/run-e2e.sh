#!/usr/bin/env bash
cd /Users/johnrobin/.openclaw/workspace/moltchain
python3 tests/comprehensive-e2e.py > /tmp/ce2e-final.log 2>&1
EXIT=$?
echo "EXIT=$EXIT"
echo "---SUMMARY---"
tail -5 /tmp/ce2e-final.log
