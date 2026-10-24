export const postKinds = [{ value: 'update', label: 'Update' }, { value: 'milestone', label: 'Milestone' }, { value: 'funny', label: 'Funny moment' }, { value: 'question', label: 'Question' }] as const;
export function validateCommunityMedia(file: {type:string;size:number}, duration?:number) {
  if (!['image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime'].includes(file.type)) return 'Choose a JPG, PNG, WebP, MP4, MOV or WebM file.';
  if (file.size > 50 * 1024 * 1024) return 'Choose a file smaller than 50 MB.';
  if (file.type.startsWith('video/') && duration !== undefined && (!Number.isFinite(duration) || duration > 60)) return 'Videos must be 60 seconds or shorter.';
  return null;
}
export function guideFreshness(verifiedAt: string | null, now = Date.now()) {
  if (!verifiedAt) return 'Not yet verified';
  return now - new Date(verifiedAt).getTime() > 90 * 86400000 ? 'Needs rechecking' : 'Recently verified';
}
