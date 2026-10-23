// Deterministic schema generator. Generate a NEW migration when ranking eligibility changes.
import {EDITION} from '../src/edition.mjs';
const quote=s=>"'"+s.replaceAll("'","''")+"'";
const cols='mode,category,player_id,run_id,value,gain_cents,trades,submitted_at,tie_id';
const order='value DESC,gain_cents DESC,trades,submitted_at,tie_id';
const modes=['life','free'],cats=['won','financing','gain','reincarnation'];
function better(a,b){const fields=[['value','>'],['gain_cents','>'],['trades','<'],['submitted_at','<'],['tie_id','<']];return '('+fields.map(([f,op],i)=>'('+fields.slice(0,i).map(([k])=>`${a}.${k}=${b}.${k}`).concat(`${a}.${f}${op}${b}.${f}`).join(' AND ')+')').join(' OR ')+')';}
function offer(source){return `INSERT INTO sf_leaderboard_top100(${cols})
 SELECT ${cols.split(',').map(k=>'c.'+k).join(',')} FROM (${source}) c
 WHERE (EXISTS(SELECT 1 FROM sf_leaderboard_top100 b WHERE b.mode=c.mode AND b.category=c.category AND b.player_id=c.player_id AND ${better('c','b')})
 OR (NOT EXISTS(SELECT 1 FROM sf_leaderboard_top100 b WHERE b.mode=c.mode AND b.category=c.category AND b.player_id=c.player_id)
 AND ((SELECT COUNT(*) FROM sf_leaderboard_top100 b WHERE b.mode=c.mode AND b.category=c.category)<100
 OR EXISTS(SELECT 1 FROM (SELECT * FROM sf_leaderboard_top100 b WHERE b.mode=c.mode AND b.category=c.category ORDER BY value,gain_cents,trades DESC,submitted_at DESC,tie_id DESC LIMIT 1) b WHERE ${better('c','b')}))))
 ON CONFLICT(mode,category,player_id) DO UPDATE SET run_id=excluded.run_id,value=excluded.value,gain_cents=excluded.gain_cents,trades=excluded.trades,submitted_at=excluded.submitted_at,tie_id=excluded.tie_id;
`;}
function trim(mode,cat){return `DELETE FROM sf_leaderboard_top100 WHERE mode=${mode} AND category=${quote(cat)} AND player_id IN (SELECT player_id FROM sf_leaderboard_top100 WHERE mode=${mode} AND category=${quote(cat)} ORDER BY ${order} LIMIT -1 OFFSET 100);\n`;}
function scores(cat,extra=''){const value=cat==='won'?'r.equity_cents':cat==='gain'?'r.gain_cents':"CAST(json_extract(r.margin_summary,'$.totalBorrowedCents') AS INTEGER)",filter=cat==='won'?"r.outcome='won'":cat==='gain'?'r.gain_cents>0':"json_extract(r.margin_summary,'$.totalBorrowedCents')>0";return `SELECT r.mode,${quote(cat)} category,r.player_id,r.id run_id,${value} value,COALESCE(r.gain_cents,0) gain_cents,r.trades,r.submitted_at,r.id tie_id FROM sf_runs r JOIN sf_players p ON p.id=r.player_id JOIN sf_leaderboard_editions e ON e.edition=r.edition AND e.mode=r.mode WHERE r.hidden=0 AND p.banned=0 AND p.nickname IS NOT NULL AND ${filter} ${extra}`;}
function cycles(mode,extra=''){const prefix=mode==='life'?'life':'free';return `SELECT ${quote(mode)} mode,'reincarnation' category,p.id player_id,NULL run_id,p.${prefix}_completed_count value,0 gain_cents,0 trades,p.${prefix}_last_completed_at submitted_at,p.id tie_id FROM sf_players p WHERE p.banned=0 AND p.nickname IS NOT NULL AND p.${prefix}_completed_count>0 ${extra}`;}
function refill(mode,cat){const m=quote(mode),source=cat==='reincarnation'?cycles(mode):scores(cat,`AND r.mode=${m}`);return offer(`SELECT * FROM (${source}) x WHERE NOT EXISTS(SELECT 1 FROM sf_leaderboard_top100 b WHERE b.mode=x.mode AND b.category=x.category AND b.player_id=x.player_id) ORDER BY ${order} LIMIT 1`)+trim(m,cat);}
function initial(source){return `INSERT INTO sf_leaderboard_top100(${cols}) SELECT ${cols} FROM (SELECT *,ROW_NUMBER() OVER(PARTITION BY mode,category ORDER BY ${order}) global_rank FROM (SELECT *,ROW_NUMBER() OVER(PARTITION BY mode,category,player_id ORDER BY ${order}) personal_rank FROM (${source})) WHERE personal_rank=1) WHERE global_rank<=100;\n`;}
function snapshot(where){return `(SELECT COALESCE(json_group_array(json_object('category',a.category,'runId',a.run_id,'value',a.value,'rank',1+(SELECT COUNT(*) FROM sf_leaderboard_top100 b WHERE b.mode=a.mode AND b.category=a.category AND ${better('b','a')}))), '[]') FROM sf_leaderboard_top100 a WHERE ${where})`;}
export function leaderboardMigration(){
 let sql=`-- v0.16.34: additive, bounded leaderboards and deduplicated completion counters.
ALTER TABLE sf_players ADD COLUMN life_completed_count INTEGER NOT NULL DEFAULT 0 CHECK(life_completed_count>=0);
ALTER TABLE sf_players ADD COLUMN free_completed_count INTEGER NOT NULL DEFAULT 0 CHECK(free_completed_count>=0);
ALTER TABLE sf_players ADD COLUMN life_last_completed_at INTEGER;
ALTER TABLE sf_players ADD COLUMN free_last_completed_at INTEGER;
ALTER TABLE sf_runs ADD COLUMN board_before TEXT;
ALTER TABLE sf_life_completions ADD COLUMN board_before TEXT;
UPDATE sf_players SET life_completed_count=(SELECT COUNT(*) FROM sf_life_completions c JOIN sf_sessions s ON s.id=c.session_id WHERE c.player_id=sf_players.id AND s.mode='life'),free_completed_count=(SELECT COUNT(*) FROM sf_life_completions c JOIN sf_sessions s ON s.id=c.session_id WHERE c.player_id=sf_players.id AND s.mode='free'),life_last_completed_at=(SELECT MAX(c.created_at) FROM sf_life_completions c JOIN sf_sessions s ON s.id=c.session_id WHERE c.player_id=sf_players.id AND s.mode='life'),free_last_completed_at=(SELECT MAX(c.created_at) FROM sf_life_completions c JOIN sf_sessions s ON s.id=c.session_id WHERE c.player_id=sf_players.id AND s.mode='free') WHERE EXISTS(SELECT 1 FROM sf_life_completions c WHERE c.player_id=sf_players.id);
CREATE TABLE sf_leaderboard_editions(edition TEXT PRIMARY KEY,mode TEXT NOT NULL CHECK(mode IN ('life','free')));
CREATE TABLE sf_leaderboard_top100(mode TEXT NOT NULL CHECK(mode IN ('life','free')),category TEXT NOT NULL CHECK(category IN ('won','financing','gain','reincarnation')),player_id TEXT NOT NULL REFERENCES sf_players(id),run_id TEXT REFERENCES sf_runs(id) ON DELETE CASCADE,value INTEGER NOT NULL,gain_cents INTEGER NOT NULL,trades INTEGER NOT NULL,submitted_at INTEGER NOT NULL,tie_id TEXT NOT NULL,PRIMARY KEY(mode,category,player_id),CHECK((category='reincarnation' AND run_id IS NULL) OR (category<>'reincarnation' AND run_id IS NOT NULL)));
CREATE INDEX sf_top100_order ON sf_leaderboard_top100(mode,category,value DESC,gain_cents DESC,trades,submitted_at,tie_id);
`;
 for(const id of [EDITION.id,...EDITION.compatibleEditionIds||[]])for(const mode of modes)for(const suffix of ['',':margin-v1'])sql+=`INSERT INTO sf_leaderboard_editions VALUES (${quote(id+':'+EDITION.rulesets[mode]+suffix)},${quote(mode)});\n`;
 for(const cat of cats.slice(0,3))sql+=initial(scores(cat));for(const mode of modes)sql+=initial(cycles(mode));
 sql+=`CREATE TRIGGER sf_top100_run_insert AFTER INSERT ON sf_runs BEGIN
UPDATE sf_runs SET board_before=${snapshot("a.player_id=NEW.player_id AND a.mode=NEW.mode AND a.category<>'reincarnation'")} WHERE id=NEW.id;
`;
 for(const cat of cats.slice(0,3))sql+=offer(scores(cat,'AND r.id=NEW.id'))+trim('NEW.mode',cat);sql+='END;\n';
 sql+=`CREATE TRIGGER sf_top100_completion_insert AFTER INSERT ON sf_life_completions BEGIN
UPDATE sf_life_completions SET board_before=${snapshot("a.player_id=NEW.player_id AND a.mode=(SELECT mode FROM sf_sessions WHERE id=NEW.session_id) AND a.category='reincarnation'")} WHERE session_id=NEW.session_id;
UPDATE sf_players SET life_completed_count=life_completed_count+((SELECT mode FROM sf_sessions WHERE id=NEW.session_id)='life'),free_completed_count=free_completed_count+((SELECT mode FROM sf_sessions WHERE id=NEW.session_id)='free'),life_last_completed_at=CASE WHEN (SELECT mode FROM sf_sessions WHERE id=NEW.session_id)='life' THEN MAX(COALESCE(life_last_completed_at,NEW.created_at),NEW.created_at) ELSE life_last_completed_at END,free_last_completed_at=CASE WHEN (SELECT mode FROM sf_sessions WHERE id=NEW.session_id)='free' THEN MAX(COALESCE(free_last_completed_at,NEW.created_at),NEW.created_at) ELSE free_last_completed_at END WHERE id=NEW.player_id;
`;
 for(const mode of modes)sql+=offer(cycles(mode,`AND p.id=NEW.player_id AND (SELECT mode FROM sf_sessions WHERE id=NEW.session_id)=${quote(mode)}`))+trim(quote(mode),'reincarnation');sql+='END;\n';
 for(const event of ['UPDATE OF hidden,edition,mode,outcome,equity_cents,gain_cents,margin_summary,trades,submitted_at','DELETE']){const update=event!=='DELETE';sql+=`CREATE TRIGGER sf_top100_run_${update?'change':'delete'} AFTER ${event} ON sf_runs ${update?"WHEN OLD.hidden<>NEW.hidden OR OLD.edition<>NEW.edition OR OLD.mode<>NEW.mode OR OLD.outcome<>NEW.outcome OR OLD.equity_cents<>NEW.equity_cents OR OLD.gain_cents IS NOT NEW.gain_cents OR OLD.margin_summary<>NEW.margin_summary OR OLD.trades<>NEW.trades OR OLD.submitted_at<>NEW.submitted_at":''} BEGIN\nDELETE FROM sf_leaderboard_top100 WHERE run_id=OLD.id;\n`;
 // Repair from eligible historical records only on moderation/maintenance, never ordinary reads.
 for(const mode of modes)for(const cat of cats.slice(0,3)){if(update)sql+=offer(scores(cat,`AND r.mode=${quote(mode)} AND r.player_id=NEW.player_id ORDER BY value DESC,gain_cents DESC,trades,submitted_at,tie_id LIMIT 1`))+trim(quote(mode),cat);sql+=refill(mode,cat);}sql+='END;\n';}
 sql+=`CREATE TRIGGER sf_top100_player_visibility AFTER UPDATE OF banned,nickname ON sf_players WHEN OLD.banned<>NEW.banned OR (OLD.nickname IS NULL)<>(NEW.nickname IS NULL) BEGIN
DELETE FROM sf_leaderboard_top100 WHERE player_id=NEW.id;
`;for(const mode of modes)for(const cat of cats)sql+=refill(mode,cat);sql+='END;\n';
 sql+=`CREATE TRIGGER sf_top100_completion_delete AFTER DELETE ON sf_life_completions BEGIN
UPDATE sf_players SET life_completed_count=(SELECT COUNT(*) FROM sf_life_completions c JOIN sf_sessions s ON s.id=c.session_id WHERE c.player_id=OLD.player_id AND s.mode='life'),free_completed_count=(SELECT COUNT(*) FROM sf_life_completions c JOIN sf_sessions s ON s.id=c.session_id WHERE c.player_id=OLD.player_id AND s.mode='free'),life_last_completed_at=(SELECT MAX(c.created_at) FROM sf_life_completions c JOIN sf_sessions s ON s.id=c.session_id WHERE c.player_id=OLD.player_id AND s.mode='life'),free_last_completed_at=(SELECT MAX(c.created_at) FROM sf_life_completions c JOIN sf_sessions s ON s.id=c.session_id WHERE c.player_id=OLD.player_id AND s.mode='free') WHERE id=OLD.player_id;
DELETE FROM sf_leaderboard_top100 WHERE category='reincarnation' AND player_id=OLD.player_id;
`;for(const mode of modes)sql+=refill(mode,'reincarnation');sql+='END;\n';
 return sql;
}
