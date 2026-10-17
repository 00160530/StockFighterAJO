import {handle} from './api.mjs';
import html from '../admin/index.html';
import css from '../admin/style.css';
import js from '../admin/app.txt';
export default {fetch(request,env,ctx){return handle(request,env,ctx,{html,css,js});}};
