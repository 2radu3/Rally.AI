import React, { useState } from 'react';

export default function UploadArea({ onFileSelect }) {
  const [isDragging, setIsDragging] = useState(false);

  // Funcții pentru efectul de drag & drop
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.includes('video')) {
        onFileSelect(file);
      } else {
        alert('Te rog să uploadezi doar fișiere video (ex: .mp4)');
      }
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div 
      className={`w-full h-full flex flex-col items-center justify-center border-2 border-dashed rounded-2xl transition-all duration-200 ${
        isDragging ? 'border-green-500 bg-green-500/10' : 'border-gray-600 bg-gray-800/50 hover:border-gray-500 hover:bg-gray-800'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="text-6xl mb-4">📂</div>
      <h3 className="text-xl font-bold text-white mb-2">Trage un video aici</h3>
      <p className="text-gray-400 mb-6 text-sm">sau apasă pe butonul de mai jos (MP4, MOV, max 50MB)</p>
      
      <label className="bg-white text-gray-900 px-6 py-2 rounded-lg font-bold cursor-pointer hover:bg-gray-200 transition-colors">
        Selectează un fișier
        <input 
          type="file" 
          className="hidden" 
          accept="video/mp4,video/x-m4v,video/*" 
          onChange={handleFileInput}
        />
      </label>
    </div>
  );
}