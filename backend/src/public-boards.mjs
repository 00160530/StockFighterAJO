import {boardSnapshot,CATEGORIES} from './boards.mjs';
import {EDITION} from './edition.mjs';
import {readProfile} from './profile.mjs';
import {hasPublicCache,publicData} from './public-cache.mjs';
export async function publicBoards(request,env,playerId=null,scope={}){
 if(!hasPublicCache(env))return {boards:await boardSnapshot(env,playerId,null,scope),generatedAt:Math.floor(Date.now()/1000),cache:'BYPASS'};
 const snapshot=await publicData(request,env,'boards:'+EDITION.id+':'+(scope.mode||'all')+':'+(scope.board||'all'),()=>boardSnapshot(env,null,null,{...scope,owners:true}));
 const boards=snapshot.data;
 const [own,profile]=playerId?await Promise.all([boardSnapshot(env,playerId,null,{...scope,entryOnly:true}),readProfile(env,playerId)]):[null,null];
 for(const mode of ['life','free'])for(const category of CATEGORIES){const board=boards[mode][category];
  board.items=board.items.map(({_owner,...item})=>({...item,isOwn:!!playerId&&_owner===playerId,...(playerId&&_owner===playerId?{nickname:profile.nickname,avatarId:profile.avatarId,avatarCharacter:profile.avatarCharacter}:{})}));
  board.entry=own?.[mode][category].entry??null;
 }
 return {boards,generatedAt:Math.floor(snapshot.createdAt/1000),cache:snapshot.status};
}
