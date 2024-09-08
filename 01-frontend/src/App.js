import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import DiffViewer from './DiffViewer';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/diff-viewer" element={<DiffViewer />} />
        {/* Add other routes as needed */}
      </Routes>
    </Router>
  );
}

export default App;