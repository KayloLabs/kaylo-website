'use client';
import {useEffect,useState,type ReactNode} from 'react';
import {isTopLevelWindow} from '../lib/frame-safety';
export function TopLevelOnly({children,landmark=false}:{children:ReactNode;landmark?:boolean}){
 const [allowed,setAllowed]=useState(false);
 const [checked,setChecked]=useState(false);
 useEffect(()=>{setAllowed(isTopLevelWindow(window));setChecked(true);},[]);
 // Sensitive children never mount or render server-side inside an iframe.
 const Tag=landmark?'main':'div';
 if(!allowed)return <Tag id={landmark?'main':undefined} tabIndex={landmark?-1:undefined} style={{padding:'3rem',fontFamily:'sans-serif'}} role="status">
  {checked?'Open Kaylo directly in a browser tab to continue.':'Opening secure page…'}
  <noscript>Enable JavaScript and open this page directly to continue.</noscript>
 </Tag>;
 return children;
}
