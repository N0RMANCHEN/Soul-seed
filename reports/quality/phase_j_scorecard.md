# Phase J Evaluation Scorecard

- Timestamp: 2026-02-26T15:14:41.236Z
- Dataset: datasets/quality/phase_j_engagement_cases.json
- Cases: 6
- Pass: true

## Replay
- ReplayPassRate: 1
- TopicHitRate(B): 1
- TopicHitRate(A baseline): 0.5
- TopicHitDelta(B-A): 0.5
- BridgeCoverage(B): 1
- StarvationProtection(B): 1

## Gates
- replayPassRate >= 0.95: pass
- topicHitRateB >= 0.80: pass
- topicHitDelta >= 0.15: pass

## Failures
- none

