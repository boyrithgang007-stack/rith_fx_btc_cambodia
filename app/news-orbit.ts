/** Project a linked news satellite; keep the complete card inside its scene. */
export function newsOrbitPosition(width:number,height:number,cardWidth:number,cardHeight:number,angle:number) {
  const cx=width/2,cy=height/2;
  const rx=Math.max(0,Math.min(width*.36,width/2-16)),ry=Math.min(145,height*.24);
  const nodeX=cx+Math.cos(angle)*rx,nodeY=cy+Math.sin(angle)*ry;
  const left=Math.max(12,Math.min(width-cardWidth-12,nodeX-cardWidth/2));
  const top=Math.max(12,Math.min(height-cardHeight-12,nodeY+22));
  return {cx,cy,rx,ry,nodeX,nodeY,left,top,targetX:left+cardWidth/2,targetY:top};
}

/** Opposite phases, same angular direction; separate cards if their clamped bounds intersect. */
export function dualNewsOrbit(width:number,height:number,sizes:{width:number;height:number}[],angle:number) {
  const positions=sizes.map((s,i)=>newsOrbitPosition(width,height,s.width,s.height,angle+i*Math.PI));
  if(positions.length===2) {
    const [a,b]=positions,[sa,sb]=sizes;
    if(width<650) {
      // Separate reading lanes on narrow screens; nodes still complete synchronized orbits.
      const start=Math.max(24,(height-sa.height-sb.height-72)/2);
      a.top=start+Math.sin(angle)*12;
      b.top=start+sa.height+48-Math.sin(angle)*12;
      a.targetY=a.top;b.targetY=b.top;
      return positions;
    }
    if(a.left<b.left+sb.width+12&&a.left+sa.width+12>b.left&&a.top<b.top+sb.height+12&&a.top+sa.height+12>b.top) {
      const first=a.nodeY<=b.nodeY?0:1,second=1-first;
      const start=Math.max(12,(height-sa.height-sb.height-24)/2);
      positions[first].top=start;
      positions[second].top=start+sizes[first].height+24;
      for(const p of positions)p.targetY=p.top;
    }
  }
  return positions;
}

export function galaxyOrbit(width:number,height:number,angle:number,index:number,cardWidth=140,cardHeight=104) {
  const phase=angle+index*Math.PI/2;
  return {left:Math.max(8,Math.min(width-cardWidth-8,width/2+Math.cos(phase)*Math.min(width*.28,230)-cardWidth/2)),top:Math.max(8,Math.min(height-cardHeight-8,height/2+Math.sin(phase)*Math.min(height*.18,150)-cardHeight/2))};
}
