import { useEffect } from'react';
import { useNavigate } from'react-router-dom';

/**
 * Global keyboard shortcuts for improved navigation
 */
export const useKeyboardShortcuts = () => {
 const navigate = useNavigate();

 useEffect(() => {
 const handleKeyPress = (event: KeyboardEvent) => {
 // Only trigger if no input/textarea is focused
 const target = event.target as HTMLElement;
 if (target.tagName ==='INPUT' || target.tagName ==='TEXTAREA') {
 return;
 }

 // Cmd/Ctrl + K for search (future implementation)
 if ((event.metaKey || event.ctrlKey) && event.key ==='k') {
 event.preventDefault();
 // TODO: Open search modal
 console.log('Search shortcut triggered');
 }

 // Navigation shortcuts with Alt/Option
 if (event.altKey) {
 switch (event.key) {
 case'd':
 event.preventDefault();
 navigate('/discover');
 break;
 case'w':
 event.preventDefault();
 navigate('/wallet');
 break;
 case'p':
 event.preventDefault();
 navigate('/profile');
 break;
 case'h':
 event.preventDefault();
 navigate('/dashboard');
 break;
 }
 }
 };

 window.addEventListener('keydown', handleKeyPress);
 return () => window.removeEventListener('keydown', handleKeyPress);
 }, [navigate]);
};
