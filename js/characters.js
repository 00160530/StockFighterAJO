(function(root){'use strict';
const CHARACTERS=Object.freeze([
 Object.freeze({id:'xiaojiu',name:'小韭',sheet:'assets/xiaojiu-expressions.png?v=0.14.2',serious:'assets/xiaojiu-serious.webp?v=0.14.2',moods:'assets/xiaojiu-moods-flat-1-10.webp?v=0.14.2',intro:'assets/intro/'}),
 Object.freeze({id:'xiaoxiaojiu',name:'小小韭',sheet:'assets/characters/xiaoxiaojiu/expressions.webp?v=0.14.2',serious:'assets/characters/xiaoxiaojiu/serious.webp?v=0.14.2',moods:'assets/characters/xiaoxiaojiu/moods.webp?v=0.14.2',intro:'assets/characters/xiaoxiaojiu/intro/'})
]);
const get=id=>CHARACTERS.find(c=>c.id===id)||CHARACTERS[0];
function profile(raw){const valid=CHARACTERS.some(c=>c.id===raw?.selected);return {selected:valid?raw.selected:'xiaojiu',chosen:valid&&raw.chosen===true};}
function choose(raw,id){if(!CHARACTERS.some(c=>c.id===id))throw Error('請選擇有效的角色。');return {...profile(raw),selected:id,chosen:true};}
function intro(id,path){const match=/^assets\/intro\/(cg-0[1-6]\.webp)$/.exec(path);return match?get(id).intro+match[1]+'?v=0.14.2':path;}
root.TaiguCharacters={CHARACTERS,get,profile,choose,intro};
})(globalThis);
