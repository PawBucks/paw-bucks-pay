import { describe,it,expect } from 'vitest';
import { guideFreshness,validateCommunityMedia } from '../lib/community';
describe('Community media rules',()=>{
 it('accepts a short pet video',()=>expect(validateCommunityMedia({type:'video/mp4',size:1024},60)).toBeNull());
 it('rejects videos longer than 60 seconds',()=>expect(validateCommunityMedia({type:'video/mp4',size:1024},61)).not.toBeNull());
 it('rejects unsupported uploads',()=>expect(validateCommunityMedia({type:'text/html',size:10})).not.toBeNull());
 it('limits media to 50 MB',()=>expect(validateCommunityMedia({type:'image/jpeg',size:50*1024*1024+1})).not.toBeNull());
});
describe('Guide freshness',()=>{
 it('never labels missing source verification as current',()=>expect(guideFreshness(null)).toBe('Not yet verified'));
 it('flags older than 90 days for rechecking',()=>expect(guideFreshness('2026-01-01T00:00:00Z',Date.parse('2026-04-02T00:00:00Z'))).toBe('Needs rechecking'));
});
