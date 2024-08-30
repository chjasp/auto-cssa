import Link from 'next/link';

export default function Home() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Welcome to Text File Diff Viewer</h1>
      <Link href="/diff-viewer" className="text-blue-500 hover:underline">
        Go to Diff Viewer
      </Link>
    </div>
  );
}