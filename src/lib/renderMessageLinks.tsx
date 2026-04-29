import React from"react";
import { Link } from"react-router-dom";

/**
 * Parses markdown-style links [text](url) in a string
 * and returns React elements with internal <Link> or external <a> tags.
 */
export function renderMessageLinks(message: string): React.ReactNode {
 const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
 const parts: React.ReactNode[] = [];
 let lastIndex = 0;
 let match: RegExpExecArray | null;

 while ((match = linkRegex.exec(message)) !== null) {
 if (match.index > lastIndex) {
 parts.push(message.slice(lastIndex, match.index));
 }
 const [, text, url] = match;
 const isInternal = url.startsWith("/");
 parts.push(
 isInternal ? (
 <Link key={match.index} to={url} className="text-primary underline hover:text-primary/80">
 {text}
 </Link>
 ) : (
 <a key={match.index} href={url} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">
 {text}
 </a>
 )
 );
 lastIndex = match.index + match[0].length;
 }

 if (lastIndex < message.length) {
 parts.push(message.slice(lastIndex));
 }

 return parts.length > 0 ? parts : message;
}
