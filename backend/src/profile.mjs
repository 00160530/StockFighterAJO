import {exactKeys,fail,integer,nickname,rate} from './security.mjs';
export async function readProfile(env,id){
 const p=await env.DB.prepare('SELECT nickname,avatar_id,avatar_character FROM sf_players WHERE id=?').bind(id).first();
 return {nickname:p.nickname||null,avatarId:p.avatar_id,avatarCharacter:p.avatar_character};
}
export async function saveProfile(env,id,body,now){
 exactKeys(body,['nickname','avatarId','avatarCharacter']);
 await rate(env,'profile:'+id,30,3600,now);
 const current=await readProfile(env,id),name=body.nickname===undefined?current.nickname:nickname(body.nickname);
 if(!name)fail(400,'NICKNAME_REQUIRED','請先設定玩家暱稱。');
 if(current.nickname&&name!==current.nickname)fail(409,'NICKNAME_LOCKED','暱稱設定後即固定，無法修改。',{nickname:current.nickname});
 const avatarId=integer(body.avatarId===undefined?current.avatarId:body.avatarId,1,10,'心情頭像'),avatarCharacter=body.avatarCharacter===undefined?current.avatarCharacter:body.avatarCharacter;
 if(!['xiaojiu','xiaoxiaojiu'].includes(avatarCharacter))fail(400,'INVALID_AVATAR','角色頭像不正確。');
 try{await env.DB.prepare('UPDATE sf_players SET nickname=?,avatar_id=?,avatar_character=? WHERE id=? AND (nickname IS NULL OR nickname=?)').bind(name,avatarId,avatarCharacter,id,name).run();}
 catch(e){if([e.message,e.cause?.message].some(s=>s?.includes('SF_NICKNAME_TAKEN')))fail(409,'NICKNAME_TAKEN','這個暱稱已有人使用，請換一個暱稱。');throw e;}
 const saved=await readProfile(env,id);
 if(saved.nickname!==name)fail(409,'NICKNAME_LOCKED','暱稱設定後即固定，無法修改。',{nickname:saved.nickname});
 return saved;
}
