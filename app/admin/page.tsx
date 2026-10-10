import type {Metadata} from 'next';
import AdminExperience from '../../components/admin/AdminExperience';
import './admin.css';
import './intro.css';
export const metadata:Metadata={title:'Kaylo | Admin',robots:{index:false,follow:false},referrer:'no-referrer'};
export default function Page(){return <AdminExperience/>;}
