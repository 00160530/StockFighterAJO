-- Rank both legacy cash/margin editions together, without rewriting any run or moderation data.
CREATE INDEX IF NOT EXISTS sf_runs_outcome_ranking ON sf_runs(edition,outcome,hidden,player_id,equity_cents DESC,gain_cents DESC,trades,submitted_at,id);
