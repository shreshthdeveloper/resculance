import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Activity, FileText, Pill, Paperclip, CheckCircle, 
  Trash2, Upload, Download 
} from 'lucide-react';
import { Card } from '../ui/Card';

export default function MedicalReportsCard({
  isActive,
  user,
  sessionData,
  loadingData,
  newNote,
  setNewNote,
  newMedication,
  setNewMedication,
  loadingNote,
  loadingMedication,
  uploadingFile,
  handleAddNote,
  handleAddMedication,
  handleFileUpload,
  handleDeleteData,
  handleDownloadFile
}) {
  const [activeTab, setActiveTab] = useState('notes');

  return (
    <Card className="p-3 h-[400px] flex flex-col overflow-hidden">
      <h3 className="text-sm font-semibold text-text mb-2 flex items-center gap-2">
        <Activity className="w-4 h-4" /> Reports
      </h3>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-border mb-2 flex-shrink-0">
        {['Notes', 'Meds', 'Files'].map((tab) => (
          <button 
            key={tab} 
            onClick={() => setActiveTab(tab.toLowerCase())} 
            className={`pb-2 px-3 text-sm font-medium border-b-2 transition-colors ${ 
              activeTab === tab.toLowerCase() 
                ? 'border-primary text-primary' 
                : 'border-transparent text-text-secondary hover:text-text' 
            }`}
          >
            <span className="flex items-center gap-2">
              {tab === 'Notes' && <FileText className="w-4 h-4" />}
              {tab === 'Meds' && <Pill className="w-4 h-4" />}
              {tab === 'Files' && <Paperclip className="w-4 h-4" />}
              <span>{tab}</span>
              {/* Count badge: handle different key names (meds -> medications) and fall back to array lengths */}
              <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-semibold rounded-full ${
                activeTab === tab.toLowerCase() ? 'bg-primary text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                {(() => {
                  const counts = sessionData.counts || {};
                  if (tab === 'Meds') return counts.medications ?? sessionData.medications?.length ?? 0;
                  const key = tab.toLowerCase();
                  return counts[key] ?? (sessionData[key]?.length ?? 0) ?? 0;
                })()}
              </span>
            </span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto hidden-scrollbar">
        {/* Notes Tab */}
        {activeTab === 'notes' && (
          <div className="space-y-1">
            {isActive && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-2 mb-2">
                  <FileText className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <label className="text-sm font-semibold text-blue-900 dark:text-blue-100 block mb-2">
                      Add Note
                    </label>
                    <textarea
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Document patient condition..."
                      className="w-full p-2 border border-blue-300 dark:border-blue-700 rounded bg-white dark:bg-gray-800 text-text text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                      rows={2}
                    />
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-blue-600 dark:text-blue-300">
                        {newNote.length}/1000
                      </span>
                      <button 
                        onClick={handleAddNote}
                        disabled={loadingNote}
                        className="px-3 py-1 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 rounded"
                      >
                        {loadingNote ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Notes List */}
            {loadingData ? (
              <div className="text-center py-2">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : sessionData.notes.length === 0 ? (
              <div className="text-center py-4">
                <FileText className="w-8 h-8 mx-auto mb-2 text-text-secondary opacity-30" />
                <p className="text-sm text-text-secondary">No notes yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sessionData.notes.slice().reverse().map((note) => (
                  <div 
                    key={note.id}
                    className="p-3 bg-white dark:bg-gray-800 rounded border-l-2 border-blue-500"
                  >
                    <p className="text-sm text-text leading-normal mb-1">{note.content.text}</p>
                    <div className="flex items-center justify-between text-xs text-text-secondary">
                      <span>{note.addedBy.name}</span>
                      <span>{new Date(note.addedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Medications Tab */}
        {activeTab === 'meds' && (
          <div className="space-y-1.5">
            {isActive && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-green-50 dark:bg-green-900/20 rounded border border-green-200"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Pill className="w-4 h-4 text-green-600" />
                  <label className="text-sm font-semibold text-green-900">
                    Administer
                  </label>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-green-700 mb-1 block">
                      Name
                    </label>
                    <input
                      type="text"
                      value={newMedication.name}
                      onChange={(e) => setNewMedication({ ...newMedication, name: e.target.value })}
                      placeholder="Med name"
                      className="w-full p-2 border border-green-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-green-700 mb-1 block">
                      Dose
                    </label>
                    <input
                      type="text"
                      value={newMedication.dosage}
                      onChange={(e) => setNewMedication({ ...newMedication, dosage: e.target.value })}
                      placeholder="150 mg"
                      className="w-full p-2 border border-green-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-green-700 mb-1 block">
                      Route
                    </label>
                    <select
                      value={newMedication.route}
                      onChange={(e) => setNewMedication({ ...newMedication, route: e.target.value })}
                      className="w-full p-2 border border-green-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    >
                      <option value="oral">Oral</option>
                      <option value="iv">Intravenous (IV)</option>
                      <option value="im">Intramuscular (IM)</option>
                      <option value="subcutaneous">Subcutaneous</option>
                      <option value="inhalation">Inhalation</option>
                      <option value="topical">Topical</option>
                      <option value="sublingual">Sublingual</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end mt-2">
                  <button 
                    onClick={handleAddMedication}
                    disabled={!newMedication.name.trim() || !newMedication.dosage.trim() || loadingMedication}
                    className="flex items-center gap-1 px-3 py-1 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 rounded transition-colors"
                  >
                    {loadingMedication ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </motion.div>
            )}

            {loadingData ? (
              <div className="text-center py-2">
                <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : sessionData.medications.length === 0 ? (
              <div className="text-center py-4">
                <Pill className="w-8 h-8 mx-auto mb-2 text-text-secondary opacity-30" />
                <p className="text-sm text-text-secondary">No medications yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sessionData.medications.slice().reverse().map((med) => (
                  <div 
                    key={med.id}
                    className="p-3 bg-white dark:bg-gray-800 rounded border-l-2 border-green-500"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <p className="font-semibold text-sm text-text">{med.content.name}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
                        {med.content.dosage}
                      </span>
                      <span className="text-text-secondary uppercase">
                        {med.content.route}
                      </span>
                    </div>
                    <div className="text-xs text-text-secondary mt-1">
                      <span>{med.addedBy.name}</span> • <span>{new Date(med.addedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Files Tab */}
        {activeTab === 'files' && (
          <div className="space-y-1.5">
            {isActive && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative"
              >
                <label 
                  htmlFor="file-upload"
                  className={`flex flex-col items-center justify-center w-full h-16 border border-dashed rounded cursor-pointer transition-all ${
                    uploadingFile 
                      ? 'border-purple-400 bg-purple-50' 
                      : 'border-purple-300 bg-purple-50/50 hover:bg-purple-100'
                  }`}
                >
                  <div className="flex flex-col items-center justify-center py-2">
                    {uploadingFile ? (
                      <>
                        <Activity className="w-5 h-5 text-purple-600 animate-spin mb-1" />
                        <p className="text-sm text-purple-600">Uploading...</p>
                      </>
                    ) : (
                      <>
                        <Upload className="w-5 h-5 text-purple-600 mb-1" />
                        <p className="text-sm text-purple-700 font-semibold">
                          Click to upload
                        </p>
                        <p className="text-xs text-purple-600">
                          PDF, Images (Max 10MB)
                        </p>
                      </>
                    )}
                  </div>
                  <input
                    id="file-upload"
                    type="file"
                    onChange={handleFileUpload}
                    accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx,.xls,.xlsx"
                    className="hidden"
                    disabled={uploadingFile}
                  />
                </label>
              </motion.div>
            )}

            {loadingData ? (
              <div className="text-center py-2">
                <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : sessionData.files.length === 0 ? (
              <div className="text-center py-4">
                <Paperclip className="w-8 h-8 mx-auto mb-2 text-text-secondary opacity-30" />
                <p className="text-sm text-text-secondary">No files yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sessionData.files.slice().reverse().map((file) => (
                  <div 
                    key={file.id}
                    className="p-3 bg-white dark:bg-gray-800 rounded border-l-2 border-purple-500"
                  >
                    <div className="flex items-center gap-2 justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-text truncate">{file.content.filename}</p>
                        <div className="flex items-center gap-2 text-xs text-text-secondary mt-1">
                          <span>{(file.content.size / 1024).toFixed(1)} KB</span>
                          <span>•</span>
                          <span>{file.addedBy.name}</span>
                          <span>•</span>
                          <span>{new Date(file.addedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDownloadFile(file.id)}
                        className="p-2 bg-purple-100 hover:bg-purple-200 text-purple-600 rounded transition-colors"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
