import type {Metadata} from 'next';
import AdminExperience from '../../components/admin/AdminExperience';
import './admin.css';
import './finance.css';
import './privacy.css';
import './support.css';
import './intro.css';
import './workspace.css';
export const metadata:Metadata={title:'Kaylo | Admin',robots:{index:false,follow:false},referrer:'no-referrer'};
export default function Page(){return <AdminExperience/>;}
