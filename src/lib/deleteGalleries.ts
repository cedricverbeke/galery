import { supabase, PREVIEW_BUCKET, FINAL_HD_BUCKET } from '@/lib/supabase';

/** Liste tous les fichiers présents dans le dossier `{galleryId}/` d'un bucket. */
async function listFolder(bucket: string, galleryId: string): Promise<string[]> {
  const paths: string[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(galleryId, { limit: pageSize, offset });
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const f of data) {
      if (f.id) paths.push(`${galleryId}/${f.name}`); // ignore les sous-dossiers vides
    }
    if (data.length < pageSize) break;
  }
  return paths;
}

/** Supprime les fichiers d'un bucket par lots de 100. */
async function removeFiles(bucket: string, paths: string[]) {
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await supabase.storage.from(bucket).remove(paths.slice(i, i + 100));
    if (error) throw error;
  }
}

/**
 * Supprime définitivement une ou plusieurs galeries :
 * 1. efface tous les fichiers (aperçus + HD) du stockage,
 * 2. puis supprime la galerie (les lignes `photos` partent en cascade).
 *
 * Si la suppression du stockage échoue, la galerie en base n'est PAS supprimée,
 * ce qui permet de réessayer sans laisser de fichiers orphelins.
 * Retourne les ids supprimés et les erreurs éventuelles par galerie.
 */
export async function deleteGalleries(ids: string[]) {
  const deleted: string[] = [];
  const errors: { id: string; message: string }[] = [];

  for (const id of ids) {
    try {
      // Chemins connus en base + fichiers réellement présents dans le dossier
      // (couvre les fichiers orphelins d'un ancien envoi interrompu).
      const { data: rows, error: phErr } = await supabase
        .from('photos')
        .select('type, file_path')
        .eq('gallery_id', id);
      if (phErr) throw phErr;

      const previews = new Set<string>(
        (rows ?? []).filter((r) => r.type === 'preview').map((r) => r.file_path),
      );
      const finals = new Set<string>(
        (rows ?? []).filter((r) => r.type === 'final_hd').map((r) => r.file_path),
      );
      (await listFolder(PREVIEW_BUCKET, id)).forEach((p) => previews.add(p));
      (await listFolder(FINAL_HD_BUCKET, id)).forEach((p) => finals.add(p));

      await removeFiles(PREVIEW_BUCKET, [...previews]);
      await removeFiles(FINAL_HD_BUCKET, [...finals]);

      const { error: galErr } = await supabase.from('galleries').delete().eq('id', id);
      if (galErr) throw galErr;

      deleted.push(id);
    } catch (err) {
      const message = err instanceof Error ? err.message : (err as { message?: string })?.message ?? 'Erreur inconnue';
      errors.push({ id, message });
    }
  }

  return { deleted, errors };
}
