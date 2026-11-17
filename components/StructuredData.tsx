import { serializeStructuredData } from '../lib/site-metadata';

/** Server-rendered data for search engines; no client script or user input. */
export function StructuredData({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeStructuredData(data) }}/>;
}
