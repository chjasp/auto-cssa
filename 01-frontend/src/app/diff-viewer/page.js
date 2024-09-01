'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { diffLines } from 'diff';
import Popup from '../../components/Popup';

const ReactDiffViewer = dynamic(() => import('react-diff-viewer-continued'), {
  ssr: false,
});

export default function DiffViewer() {
  const [currentText, setCurrentText] = useState('');
  const [updatedText, setUpdatedText] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [hasUpdate, setHasUpdate] = useState(false);
  const [diffs, setDiffs] = useState([]);
  const [selectedDiff, setSelectedDiff] = useState(null);
  const [showPopup, setShowPopup] = useState(false);
  const searchParams = useSearchParams();

  const fetchAssessment = useCallback(async () => {
    const serviceSlug = searchParams.get('service');
    if (serviceSlug) {
      try {
        const response = await fetch(`http://localhost:8000/api/assessment/${serviceSlug}`);
        if (!response.ok) {
          throw new Error('Failed to fetch assessment');
        }
        const data = await response.json();
        setCurrentText(data.current_assessment);
        setUpdatedText(data.updated_assessment || data.current_assessment);
        setHasUpdate(!!data.updated_assessment);
        setServiceName(serviceSlug);
        const computedDiffs = diffLines(data.current_assessment, data.updated_assessment || data.current_assessment);
        
        let currentLine = 0;
        let updatedLine = 0;
        const diffsWithLines = computedDiffs.map(diff => {
          const lines = diff.value.split('\n').length - 1;
          const result = {
            ...diff,
            currentStartLine: currentLine,
            currentEndLine: currentLine + (diff.removed ? lines : 0),
            updatedStartLine: updatedLine,
            updatedEndLine: updatedLine + (diff.added ? lines : 0),
          };
          if (!diff.added) currentLine += lines;
          if (!diff.removed) updatedLine += lines;
          return result;
        });
        
        setDiffs(diffsWithLines);
      } catch (error) {
        console.error('Error fetching assessment:', error);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    fetchAssessment();
  }, [fetchAssessment]);

  const handleLineClick = useCallback((lineId) => {
    const lineNumber = parseInt(lineId.split('-')[1], 10);
    const diff = diffs.find(d => 
      (lineNumber >= d.currentStartLine && lineNumber <= d.currentEndLine) ||
      (lineNumber >= d.updatedStartLine && lineNumber <= d.updatedEndLine)
    );
    console.log(diff);
    setSelectedDiff(diff || null);
    setShowPopup(true);
  }, [diffs]);

  const closePopup = () => {
    setShowPopup(false);
    setSelectedDiff(null);
  };

  const handleAccept = async () => {
    if (selectedDiff) {
      try {
        const response = await fetch(`http://localhost:8000/api/accept_change/${serviceName}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            currentStartLine: selectedDiff.currentStartLine,
            currentEndLine: selectedDiff.currentEndLine,
            updatedStartLine: selectedDiff.updatedStartLine,
            updatedEndLine: selectedDiff.updatedEndLine,
          }),
        });
        if (!response.ok) {
          throw new Error('Failed to accept change');
        }
        closePopup();
        await fetchAssessment(); // Refetch the assessment data
      } catch (error) {
        console.error('Error accepting change:', error);
      }
    }
  };

  const handleReject = async () => {
    if (selectedDiff) {
      try {
        const response = await fetch(`http://localhost:8000/api/reject_change/${serviceName}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            currentStartLine: selectedDiff.currentStartLine,
            currentEndLine: selectedDiff.currentEndLine,
            updatedStartLine: selectedDiff.updatedStartLine,
            updatedEndLine: selectedDiff.updatedEndLine,
          }),
        });
        if (!response.ok) {
          throw new Error('Failed to reject change');
        }
        closePopup();
        await fetchAssessment(); // Refetch the assessment data
      } catch (error) {
        console.error('Error rejecting change:', error);
      }
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Security Assessment for {serviceName}</h1>
      {hasUpdate ? (
        <div>
          <ReactDiffViewer 
            oldValue={currentText} 
            newValue={updatedText} 
            splitView={true} 
            compareMethod="diffLines"
            diffMethod={diffLines}
            onLineNumberClick={handleLineClick}
          />
          {showPopup && (
            <Popup
              metadata={selectedDiff}
              onClose={closePopup}
              onAccept={handleAccept}
              onReject={handleReject}
            />
          )}
        </div>
      ) : (
        <div>
          <h2 className="text-xl mb-2">Current Assessment:</h2>
          <pre className="bg-gray-100 p-4 rounded">{currentText}</pre>
        </div>
      )}
    </div>
  );
}