import Image from "next/image";
export default function RfxLoader(){
  return <div className="rfx-loading" role="status" aria-live="polite" aria-label="RFX TEAM is loading"><div className="rfx-loading-content"><div className="rfx-loading-emblem"><span className="rfx-loading-ring" aria-hidden="true"/><Image src="/brand/rfx-team-logo.png" alt="RFX Team" width={80} height={45} priority/></div><p className="rfx-loading-brand">RFX TEAM</p><svg className="rfx-loading-wave" viewBox="0 0 120 32" aria-hidden="true"><path className="rfx-wave-base" d="M2 20h28l9-8 10 15 10-11 8 4h20l9-11 13 21 5-5h4"/><path className="rfx-wave-light" d="M2 20h28l9-8 10 15 10-11 8 4h20l9-11 13 21 5-5h4"/></svg></div></div>;
}
