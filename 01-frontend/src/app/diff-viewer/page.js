import { useState } from 'react';
import dynamic from 'next/dynamic';

const ReactDiffViewer = dynamic(() => import('react-diff-viewer-continued'), {
  ssr: false,
});

export default function DiffViewer() {
  const [oldText, setOldText] = useState('');
  const [newText, setNewText] = useState('');

  const handleFileUpload = (e, setter) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setter(e.target?.result);
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Text File Diff Viewer</h1>
      <div className="mb-4">
        <label className="block mb-2">
          Old File:
          <input type="file" onChange={(e) => handleFileUpload(e, setOldText)} className="block" />
        </label>
        <label className="block mb-2">
          New File:
          <input type="file" onChange={(e) => handleFileUpload(e, setNewText)} className="block" />
        </label>
      </div>
      <ReactDiffViewer oldValue={oldText} newValue={newText} splitView={true} />
    </div>
  );
}