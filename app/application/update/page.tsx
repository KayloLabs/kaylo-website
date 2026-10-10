import type {Metadata} from 'next';
import ApplicationUpdate from '../../../components/admin/ApplicationUpdate';
import '../../admin/admin.css';
export const metadata:Metadata={title:'Update your application | Kaylo',robots:{index:false,follow:false},referrer:'no-referrer'};
export default function Page(){return <ApplicationUpdate/>;}
