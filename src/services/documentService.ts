import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  orderBy,
  deleteDoc,
  onSnapshot,
  getDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { cachedFetch, invalidateCache, setCachedData } from './dbCache';
import { trackDBOperation } from './dbTrackingService';
import type { DocumentFile } from '../types';
import { uploadFileToSupabase, removeFileFromSupabase, extractSupabasePathFromPublicUrl } from '../utils/supabase';

function now() {
  return new Date().toISOString();
}

/**
 * Upload document metadata to Firestore, uploading the file payload to Supabase Storage if provided.
 */
export async function uploadDocument(
  data: Omit<DocumentFile, 'id' | 'createdAt'>,
  fileObj?: File
): Promise<string> {
  let fileUrl = data.fileUrl || '';
  let supabasePath = data.supabasePath || '';

  if (fileObj) {
    const yearPrefix = data.academicYear ? data.academicYear.replace(/[^a-zA-Z0-9-]/g, '_') : 'general';
    const cleanFileName = fileObj.name.replace(/\s+/g, '_');
    const storageDest = `documents/${yearPrefix}/${Date.now()}_${cleanFileName}`;

    try {
      fileUrl = await uploadFileToSupabase(fileObj, storageDest, 'SAINT STRBUCK');
      supabasePath = storageDest;
    } catch (e) {
      console.warn('Failed uploading document to Supabase Storage, using fallback:', e);
    }
  }

  const payload: Record<string, any> = {
    title: data.title,
    fileName: data.fileName,
    fileType: data.fileType,
    uploadedBy: data.uploadedBy,
    uploadedByName: data.uploadedByName,
    createdAt: now(),
  };

  if (data.description) payload.description = data.description;
  if (data.academicYear) payload.academicYear = data.academicYear;
  if (data.category) payload.category = data.category;
  if (data.eventId) payload.eventId = data.eventId;
  if (data.eventName) payload.eventName = data.eventName;
  if (data.fileSize) payload.fileSize = data.fileSize;
  if (fileUrl) payload.fileUrl = fileUrl;
  if (supabasePath) payload.supabasePath = supabasePath;
  if (data.fileDataUrl) payload.fileDataUrl = data.fileDataUrl;

  const ref = await addDoc(collection(db, 'documents'), payload);
  invalidateCache('documents:');
  trackDBOperation({ operation: 'write', action: 'upload_document', resource: 'documents', documentCount: 1 });
  return ref.id;
}

/**
 * Update an existing document record in Firestore.
 */
export async function updateDocument(id: string, updates: Partial<DocumentFile>): Promise<void> {
  const docRef = doc(db, 'documents', id);
  const payload: Record<string, any> = {};

  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.academicYear !== undefined) payload.academicYear = updates.academicYear;
  if (updates.category !== undefined) payload.category = updates.category;
  if (updates.eventId !== undefined) payload.eventId = updates.eventId;
  if (updates.eventName !== undefined) payload.eventName = updates.eventName;

  await updateDoc(docRef, payload);
  invalidateCache('documents:');
  trackDBOperation({ operation: 'update', action: 'update_document', resource: 'documents', documentCount: 1 });
}

export async function deleteDocument(id: string) {
  try {
    const docRef = doc(db, 'documents', id);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as DocumentFile;
      const pathToRemove = data.supabasePath || (data.fileUrl ? extractSupabasePathFromPublicUrl(data.fileUrl) : undefined);
      if (pathToRemove) {
        await removeFileFromSupabase(pathToRemove, 'SAINT STRBUCK').catch((err) => {
          console.warn('Supabase storage cleanup failed for document:', id, err);
        });
      }
    }
  } catch (e) {
    console.warn('Error during document deletion pre-check:', e);
  }

  await deleteDoc(doc(db, 'documents', id));
  invalidateCache('documents:');
  trackDBOperation({ operation: 'delete', action: 'delete_document', resource: 'documents', documentCount: 1 });
}

export async function getDocuments(forceRefresh = false): Promise<DocumentFile[]> {
  return cachedFetch<DocumentFile[]>(
    'documents:all',
    async () => {
      const snap = await getDocs(query(collection(db, 'documents'), orderBy('createdAt', 'desc')));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as DocumentFile));
    },
    {
      ttlMs: 60 * 1000,
      resource: 'documents',
      action: 'get_documents',
      forceRefresh,
    }
  );
}

export function subscribeDocuments(callback: (docs: DocumentFile[]) => void) {
  trackDBOperation({ operation: 'listener', action: 'subscribe_documents', resource: 'documents' });
  return onSnapshot(query(collection(db, 'documents'), orderBy('createdAt', 'desc')), (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as DocumentFile));
    setCachedData('documents:all', items);
    callback(items);
  });
}

/**
 * Robust document file download helper.
 * Downloads the file blob via fetch or opens direct link if fetch fails.
 */
export async function downloadDocumentFile(docFile: DocumentFile): Promise<void> {
  const url = docFile.fileUrl || docFile.fileDataUrl;
  if (!url) {
    throw new Error('No valid URL available for this document');
  }

  const fileName = docFile.fileName || docFile.title || 'document';

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP status ${response.status}`);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
  } catch (err) {
    console.warn('Direct blob download failed, attempting direct window link:', err);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}
