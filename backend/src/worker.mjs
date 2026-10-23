import {handle} from './api.mjs';
import html from '../admin/index.html';
import css from '../admin/style.css';
import js from '../admin/app.txt';
import exportJs from '../admin/export.txt';
import snapshotJs from '../admin/snapshot.txt';
import excelJs from '../admin/exceljs.txt';
export default {fetch(request,env,ctx){return handle(request,env,ctx,{html,css,js,exportJs,excelJs,snapshotJs});}};
