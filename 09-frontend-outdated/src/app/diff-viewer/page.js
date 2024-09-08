'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { diffLines } from 'diff';
import Popup from '../../components/Popup';
import useAssessment from '../../hooks/useAssessment';

const ReactDiffViewer = dynamic(() => import('react-diff-viewer-continued'), {
  ssr: false,
});

export default function DiffViewer() {
  const searchParams = useSearchParams();
  const serviceSlug = searchParams.get('service');
  const { assessment, isLoading, error, acceptBlockChange, rejectBlockChange } = useAssessment(serviceSlug);

  const [selectedBlockIndex, setSelectedBlockIndex] = useState(null);
  const [showPopup, setShowPopup] = useState(false);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!assessment) return <div>No assessment found</div>;

  const { currentText, updatedText, serviceName, hasUpdate, changeBlocks } = assessment;

  const handleBlockClick = (blockIndex) => {
    setSelectedBlockIndex(blockIndex);
    setShowPopup(true);
  };

  const handleAccept = async (blockIndex) => {
    await acceptBlockChange(blockIndex);
  };

  const handleReject = async (blockIndex) => {
    await rejectBlockChange(blockIndex);
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Security Assessment for {serviceName}</h1>
      {hasUpdate ? (
        <div>
          {changeBlocks.map((block, index) => (
            <div key={index} className="mb-4">
              <button onClick={() => handleAccept(index)} className="mr-2 px-2 py-1 bg-green-500 text-white rounded">Accept Block {index + 1}</button>
              <button onClick={() => handleReject(index)} className="px-2 py-1 bg-red-500 text-white rounded">Reject Block {index + 1}</button>
            </div>
          ))}
          <ReactDiffViewer 
            oldValue={currentText} 
            newValue={updatedText} 
            splitView={false} 
            inline={true}
            useDarkTheme={false}
            compareMethod="diffLines"
            styles={{
              diffAdded: { backgroundColor: '#e6ffec' },
              diffRemoved: { backgroundColor: '#ffebe9' },
            }}
          />
        </div>
      ) : (
        <div>
          <h2 className="text-xl mb-2">Current Assessment:</h2>
          <pre className="bg-gray-100 p-4 rounded">{currentText}</pre>
        </div>
      )}
      {showPopup && (
        <Popup
          blockIndex={selectedBlockIndex}
          onAccept={handleAccept}
          onReject={handleReject}
          onClose={() => setShowPopup(false)}
        />
      )}
    </div>
  );
}