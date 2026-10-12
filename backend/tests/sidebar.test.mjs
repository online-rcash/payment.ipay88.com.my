import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
test('closed sidebar releases clicks; rapid close and reopen keeps the drawer open',()=>{
 const frames=[];
 const make=(names=[])=>{const classes=new Set(names);return {hidden:true,inert:true,style:{},attrs:{},focus(){},querySelector(){return {focus(){}}},setAttribute(k,v){this.attrs[k]=v},getAttribute(k){return this.attrs[k]},classList:{contains:k=>classes.has(k),add:k=>classes.add(k),remove:k=>classes.delete(k)}}};
 const overlay=make(['hidden','opacity-0']), menu=make(['translate-x-full']), toggle=make();
 const nodes={sidebarOverlay:overlay,sidebarMenu:menu,sidebarToggleButton:toggle};
 const context={window:{},document:{getElementById:id=>nodes[id],body:{style:{}},activeElement:toggle,querySelectorAll:()=>[],addEventListener(){}},requestAnimationFrame:fn=>frames.push(fn),clearTimeout(){},setTimeout(){},setInterval(){},console};
 vm.runInNewContext(readFileSync(new URL('../../script.js',import.meta.url),'utf8'),context);
 context.openSidebar();frames.splice(0).forEach(fn=>fn());assert.equal(overlay.hidden,false);assert.equal(menu.inert,false);assert.equal(toggle.attrs['aria-expanded'],'true');
 context.closeSidebar();assert.equal(overlay.hidden,true);assert.equal(menu.inert,true);assert.equal(overlay.attrs['aria-hidden'],'true');
 context.openSidebar();context.closeSidebar();context.openSidebar();frames.splice(0).forEach(fn=>fn());assert.equal(overlay.hidden,false);assert.equal(overlay.attrs['aria-hidden'],'false');assert.equal(menu.classList.contains('translate-x-full'),false);
});
