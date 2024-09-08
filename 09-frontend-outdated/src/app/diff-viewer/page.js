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
  const [changeBlocks, setChangeBlocks] = useState([]);
  const [selectedBlockIndex, setSelectedBlockIndex] = useState(null);
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
        
        // Identify blocks of consecutive changes
        let currentBlock = [];
        const blocks = [];
        
        diffsWithLines.forEach((diff, index) => {
          if (diff.added || diff.removed) {
            currentBlock.push(diff);
          } else if (currentBlock.length > 0) {
            blocks.push(currentBlock);
            currentBlock = [];
          }
          
          if (index === diffsWithLines.length - 1 && currentBlock.length > 0) {
            blocks.push(currentBlock);
          }
        });
        
        setChangeBlocks(blocks);
        console.log('Change blocks set:', blocks);
        
        // Log the change blocks
        blocks.forEach((block, index) => {
          console.log(`Change Block ${index + 1}:`);
          block.forEach(diff => {
            console.log(`  ${diff.added ? 'Added' : 'Removed'} lines ${diff.currentStartLine}-${diff.currentEndLine}`);
            console.log(`  Content: ${diff.value}`);
          });
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

  const handleBlockClick = (blockIndex) => {
    console.log('Block clicked:', blockIndex);
    setSelectedBlockIndex(blockIndex);
    setShowPopup(true);
    console.log('Popup should be shown now');
  };

  const handleAccept = async (blockIndex) => {
    try {
      const response = await fetch(`http://localhost:8000/api/accept_block_change/${serviceName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changeBlocks[blockIndex]),
      });
      if (response.ok) {
        fetchAssessment();
      } else {
        throw new Error('Failed to accept block change');
      }
    } catch (error) {
      console.error('Error accepting block change:', error);
    }
  };

  const handleReject = async (blockIndex) => {
    // For now, we'll just log the rejection. You can implement the actual rejection logic later.
    console.log('Rejected change block:', blockIndex);
    // You might want to refresh the assessment here as well
    fetchAssessment();
  };

  const renderContent = (str) => {
    console.log('renderContent called with:', str);
    if (typeof str !== 'string') {
      console.error('renderContent received non-string input:', str);
      return null;
    }
    return str.split('\n').map((line, i) => {
      console.log(`Processing line ${i}:`, line);
      const blockIndex = changeBlocks.findIndex(block => 
        block.some(diff => 
          (diff.removed && diff.currentStartLine <= i && i < diff.currentEndLine) ||
          (diff.added && diff.updatedStartLine <= i && i < diff.updatedEndLine)
        )
      );
      
      console.log(`Line ${i} blockIndex:`, blockIndex);
      
      if (blockIndex !== -1) {
        console.log(`Rendering change block for line ${i}`);
        return (
          <div key={i} style={{ backgroundColor: changeBlocks[blockIndex].some(d => d.removed) ? '#ffebe9' : '#e6ffec' }}>
            <span style={{ display: 'block' }}>{line}</span>
            {i === changeBlocks[blockIndex][0].currentStartLine && (
              <div>
                <button onClick={() => handleAccept(blockIndex)} style={{ marginRight: '10px' }}>Accept</button>
                <button onClick={() => handleReject(blockIndex)}>Reject</button>
              </div>
            )}
          </div>
        );
      }
      return <span key={i}>{line}</span>;
    });
  };

  console.log('Render: showPopup =', showPopup);

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
              diffAdded: {
                backgroundColor: '#e6ffec',
              },
              diffRemoved: {
                backgroundColor: '#ffebe9',
              },
            }}
          />
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