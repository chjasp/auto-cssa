import Link from 'next/link';
import { gcpServices } from '../data/gcpServices';

export default function Home() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Cloud Service Security Assessment</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {gcpServices.map((service) => (
          <Link 
            key={service.id} 
            href={`/diff-viewer?service=${service.slug}`}
            className="bg-blue-100 p-4 rounded shadow hover:shadow-md transition-shadow duration-200"
          >
            <div className="text-lg font-semibold text-blue-800">{service.name}</div>
            <div className="text-sm text-blue-600">View Security Assessment</div>
          </Link>
        ))}
      </div>
    </div>
  );
}