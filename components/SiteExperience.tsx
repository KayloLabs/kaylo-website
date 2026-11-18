import type {ReactNode} from 'react';

export function SiteExperience({children}:{children:ReactNode}){
 return <div className="site-experience" data-phase="ready">
  <div className="site-content">{children}</div>
 </div>;
}
