/* ===========================================================================
   PHOENIX BRIDGING — document storage abstraction
   Real path:  Supabase Storage bucket 'bridging-documents', object key
               '{orgId}/{dealRef}/{folder}/{docType}_v{version}_{fileName}',
               with a row written to bridging_documents (storage_path set).
   Fallback:   base64 data URL kept in the localStorage store via
               bridging-db.js (dataUrl set instead of storagePath).

   Nothing in bridging-deal.jsx needs to know which path was used — both
   return the same { ok, mode, url } shape. This file is the only thing
   that changes once the 'bridging-documents' bucket and
   db/bridging_schema.sql have actually been applied to the live project.
   =========================================================================== */
(function (global) {
  const BUCKET = 'bridging-documents';
  const MAX_LOCAL_BYTES = 4 * 1024 * 1024; // localStorage has ~5-10MB total; keep individual files well under that

  function readAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error || new Error('File read failed'));
      r.readAsDataURL(file);
    });
  }

  function objectPath(orgId, dealRef, folder, docType, version, fileName) {
    const safe = (s) => String(s || '').replace(/[^a-zA-Z0-9._-]+/g, '_');
    return [safe(orgId), safe(dealRef), safe(folder), safe(docType) + '_v' + version + '_' + safe(fileName)].join('/');
  }

  // Tries Supabase Storage first (real, persistent, shared across users);
  // falls back to a local base64 copy if the client, bucket or table isn't
  // there yet — this is expected until db/bridging_schema.sql and the
  // bucket have been created in the target Supabase project.
  async function uploadDocument({ file, orgId, dealRef, folder, docType, version }) {
    const path = objectPath(orgId, dealRef, folder, docType, version, file.name);

    if (global.sb && global.sb.storage) {
      try {
        const { error: upErr } = await global.sb.storage.from(BUCKET).upload(path, file, {
          contentType: file.type || 'application/octet-stream',
          upsert: false,
        });
        if (upErr) throw upErr;
        const { data: pub } = global.sb.storage.from(BUCKET).getPublicUrl(path);
        return { ok: true, mode: 'supabase', storagePath: path, url: pub && pub.publicUrl };
      } catch (e) {
        console.warn('[bridging-storage] Supabase Storage upload failed, falling back to local copy:', e && e.message);
        // fall through to local
      }
    }

    if (file.size > MAX_LOCAL_BYTES) {
      return { ok: false, mode: 'local', error: 'File is ' + Math.round(file.size / 1024 / 1024) + 'MB — too large for local fallback storage (4MB limit) and Supabase Storage is not reachable. Try a smaller file, or configure the bridging-documents bucket.' };
    }
    const dataUrl = await readAsDataURL(file);
    return { ok: true, mode: 'local', dataUrl, url: dataUrl };
  }

  function removeDocument({ storagePath }) {
    if (storagePath && global.sb && global.sb.storage) {
      global.sb.storage.from(BUCKET).remove([storagePath]).catch(e => console.warn('[bridging-storage] remove failed:', e && e.message));
    }
    // local (dataUrl) copies just get dropped from the store record — nothing external to clean up
  }

  global.PhoenixBridgingStorage = { uploadDocument, removeDocument, BUCKET, MAX_LOCAL_BYTES };
})(window);
