'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Search, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import AppLayout from '../../components/AppLayout';
import ReactMarkdown from 'react-markdown';
import NoteEditor from '../../components/NoteEditor';
import 'easymde/dist/easymde.min.css';

interface Note {
  id: string;
  title: string;
  content: string;
  created_at: string;
  user_id: string;
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isNoteListCollapsed, setIsNoteListCollapsed] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const { user } = useAuth();

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Filter notes based on debounced search term
  const filteredNotes = useMemo(() => {
    if (!debouncedSearchTerm) return notes;
    const lowerSearchTerm = debouncedSearchTerm.toLowerCase();
    return notes.filter(note =>
      note.title.toLowerCase().includes(lowerSearchTerm) ||
      note.content.toLowerCase().includes(lowerSearchTerm)
    );
  }, [notes, debouncedSearchTerm]);

  // Update selected note only when necessary
  useEffect(() => {
    if (filteredNotes.length > 0 && !selectedNote) {
      // Only set selectedNote if none is selected
      setSelectedNote(filteredNotes[0]);
    } else if (filteredNotes.length === 0 && selectedNote) {
      // If search results are empty, keep the current note if it exists in the original notes
      const noteStillExists = notes.some(n => n.id === selectedNote.id);
      if (!noteStillExists) {
        setSelectedNote(null);
      }
    } else if (selectedNote && !filteredNotes.some(n => n.id === selectedNote.id)) {
      // If the current selected note is no longer in filteredNotes, select the first available
      setSelectedNote(filteredNotes[0] || null);
    }
  }, [filteredNotes, selectedNote, notes]);

  const fetchNotes = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotes(data || []);
      // Only set selectedNote if none is currently selected
      if (data && data.length > 0 && !selectedNote) {
        setSelectedNote(data[0]);
      }
    } catch (error) {
      console.error('Error fetching notes:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, selectedNote]);

  useEffect(() => {
    if (user) {
      fetchNotes();
    }
  }, [user, fetchNotes]);

  const handleNewNote = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('notes')
        .insert([
          {
            title: 'Untitled Note',
            content: '',
            user_id: user?.id,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      if (data) {
        await fetchNotes();
        setSearchTerm(''); // Clear search to show all notes
        setSelectedNote(data);
        setShowPreview(false);
      }
    } catch (error) {
      console.error('Error creating note:', error);
    }
  }, [user?.id, fetchNotes]);

  const handleNoteSelect = useCallback((note: Note) => {
    setSelectedNote(note);
    setShowPreview(true);
  }, []);

  const handleSave = useCallback(async (note: Note) => {
    try {
      const { error } = await supabase
        .from('notes')
        .update({
          title: note.title,
          content: note.content,
          updated_at: new Date().toISOString(),
        })
        .eq('id', note.id);

      if (error) throw error;
      await fetchNotes();
      return true;
    } catch (error) {
      console.error('Error saving note:', error);
      throw error;
    }
  }, [fetchNotes]);

  const handleDelete = useCallback(async (noteId: string) => {
    try {
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;
      await fetchNotes();
      if (selectedNote?.id === noteId) {
        setSelectedNote(filteredNotes[0] || null);
      }
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  }, [selectedNote, filteredNotes, fetchNotes]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  }, []);

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-64px)]">
        {/* Notes List Sidebar */}
        <div className={`relative flex flex-col border-r border-gray-200 dark:border-gray-700 ${isNoteListCollapsed ? 'w-16' : 'w-80'} transition-all duration-300`}>
          {/* Toggle Button */}
          <button
            onClick={() => setIsNoteListCollapsed(!isNoteListCollapsed)}
            className="absolute -right-3 top-1/2 transform -translate-y-1/2 z-10 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full p-1 shadow-sm"
          >
            {isNoteListCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>

          {/* Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              {!isNoteListCollapsed && <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Notes</h2>}
              <button
                onClick={handleNewNote}
                className="p-2 text-blue-600 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <Plus size={20} />
              </button>
            </div>
            {!isNoteListCollapsed && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search notes..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                  className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400"
                />
              </div>
            )}
          </div>

          {/* Notes List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center items-center h-32">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : filteredNotes.length === 0 ? (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                {searchTerm ? 'No notes match your search.' : 'No notes yet. Create one!'}
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredNotes.map((note) => (
                  <div
                    key={note.id}
                    onClick={() => handleNoteSelect(note)}
                    className={`p-4 cursor-pointer transition-colors ${
                      selectedNote?.id === note.id
                        ? 'bg-blue-50 dark:bg-blue-900/20'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                    }`}
                  >
                    {isNoteListCollapsed ? (
                      <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                        <FileText size={16} />
                      </div>
                    ) : (
                      <>
                        <h3 className="font-medium text-gray-900 dark:text-white truncate mb-1">
                          {note.title || 'Untitled Note'}
                        </h3>
                        <time className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(note.created_at).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </time>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden">
          {selectedNote ? (
            <div className="h-full flex flex-col p-6">
              <div className="flex items-center justify-between mb-4">
                <input
                  type="text"
                  value={selectedNote.title}
                  onChange={(e) => setSelectedNote(prev => prev ? { ...prev, title: e.target.value } : null)}
                  onBlur={() => selectedNote && handleSave(selectedNote)}
                  className="text-2xl font-bold bg-transparent border-none outline-none text-gray-900 dark:text-white flex-1 mr-4"
                  placeholder="Untitled Note"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowPreview(false)}
                    className={`px-3 py-1 rounded-lg text-sm ${
                      !showPreview ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setShowPreview(true)}
                    className={`px-3 py-1 rounded-lg text-sm ${
                      showPreview ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    Preview
                  </button>
                  <button
                    onClick={() => handleDelete(selectedNote.id)}
                    className="px-3 py-1 rounded-lg text-sm bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/40 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {showPreview ? (
                  <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none">
                    <ReactMarkdown>{selectedNote.content || 'No content. Start typing!'}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="h-full">
                    <NoteEditor
                      noteId={selectedNote.id}
                      content={selectedNote.content}
                      onChange={(content: string) => {
                        setSelectedNote(prev => prev ? { ...prev, content: content } : null);
                      }}
                      onSave={async (contentToSave: string) => {
                        if (selectedNote) {
                          try {
                            const noteToSave = {
                              ...selectedNote,
                              content: contentToSave,
                            };
                            await handleSave(noteToSave);
                            return true;
                          } catch {
                            return false;
                          }
                        }
                        return false;
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <FileText className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                  {loading ? 'Loading notes...' : (searchTerm && filteredNotes.length === 0) ? 'No Results' : 'Select a note or create a new one'}
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {searchTerm && filteredNotes.length === 0 ? `No notes found matching "${searchTerm}".` : 'Your notes will appear here.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}