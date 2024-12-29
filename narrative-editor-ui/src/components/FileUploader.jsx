import React from 'react';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import DownloadIcon from '@mui/icons-material/Download';

const FileUploader = ({ onFileLoad, narrative }) => {
  const handleFileUpload = (event) => {
    // console.log('Upload event triggered:', event);
    // console.log('Files:', event.target.files);
    
    const file = event.target.files[0];
    if (!file) {
      // console.log('No file selected');
      return;
    }

    // console.log('File selected:', file.name, file.type, file.size);
    
    const reader = new FileReader();
    
    reader.onload = (e) => {
      // console.log('FileReader onload triggered');
      try {
        const content = e.target.result;
        // console.log('File content:', content.substring(0, 100));
        const json = JSON.parse(content);
        // console.log('Parsed JSON:', json);
        onFileLoad(json);
      } catch (error) {
        console.error('Error in file processing:', error);
        alert('Error processing file: ' + error.message);
      }
    };

    reader.onerror = () => {
      console.error('FileReader error:', reader.error);
    };

    reader.readAsText(file);
  };

  return (
    <div className="flex gap-2">
      {/* Temporary visible file input for testing */}
      <input
        type="file"
        accept=".json"
        onChange={handleFileUpload}
        style={{ display: 'block' }}
      />
      <button
        onClick={() => {
          // console.log('Current narrative:', narrative);
          const dataStr = JSON.stringify(narrative, null, 2);
          const blob = new Blob([dataStr], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'narrative.json';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }}
        className="flex items-center gap-1 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
      >
        <DownloadIcon fontSize="small" />
        <span>Save</span>
      </button>
    </div>
  );
};

export default FileUploader; 