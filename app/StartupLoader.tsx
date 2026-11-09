"use client";
import {useEffect,useState} from "react";
import RfxLoader from "./RfxLoader";
export default function StartupLoader(){
  const [visible,setVisible]=useState(true);
  useEffect(()=>{const timer=window.setTimeout(()=>setVisible(false),650);return()=>window.clearTimeout(timer);},[]);
  return visible?<RfxLoader/>:null;
}
