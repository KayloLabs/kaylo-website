'use client';
import { motion, useReducedMotion } from 'motion/react';
import paths from './logo-paths.json';
export function Logo({animated=false,className=''}:{animated?:boolean;className?:string}){
 const reduced=useReducedMotion();const play=animated&&!reduced;
 return <svg className={`kaylo-logo ${className}`} viewBox="275 300 490 390" role="img" aria-label="Kaylo" xmlns="http://www.w3.org/2000/svg"><motion.g className="logo-loop" initial={false} whileInView={play?{clipPath:['inset(0 100% 0 0)','inset(0 0% 0 0)']}:undefined} viewport={{once:true}} transition={{duration:.85,ease:'easeInOut'}}>{paths.loop.map((d,i)=><path key={i} d={d}/>)}</motion.g><motion.g className="logo-dot" initial={false} whileInView={play?{opacity:[0,0,1],scale:[.6,.6,1]}:undefined} viewport={{once:true}} transition={{duration:1,times:[0,.85,1],ease:'easeOut'}}>{paths.dot.map((d,i)=><path key={i} d={d}/>)}</motion.g><motion.g initial={false} whileInView={play?{opacity:[0,0,1],y:[8,8,0]}:undefined} viewport={{once:true}} transition={{duration:1.2,times:[0,.82,1]}}>{paths.text.map((d,i)=><path key={i} d={d}/>)}</motion.g></svg>
}
