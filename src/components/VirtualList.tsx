import { memo, useRef, ReactNode, useState, useEffect } from'react';
import { useVirtualizer, VirtualItem } from'@tanstack/react-virtual';
import { cn } from'@/lib/utils';

interface VirtualListProps<T> {
 items: T[];
 renderItem: (item: T, index: number, virtualItem: VirtualItem) => ReactNode;
 estimateSize?: number;
 overscan?: number;
 className?: string;
 gap?: number;
 getItemKey?: (item: T, index: number) => string | number;
}

/**
 * Virtualized list component for rendering large lists efficiently
 * Uses @tanstack/react-virtual for optimal performance
 */
function VirtualListComponent<T>({
 items,
 renderItem,
 estimateSize = 64,
 overscan = 5,
 className,
 gap = 0,
 getItemKey,
}: VirtualListProps<T>) {
 const parentRef = useRef<HTMLDivElement>(null);

 const virtualizer = useVirtualizer({
 count: items.length,
 getScrollElement: () => parentRef.current,
 estimateSize: () => estimateSize,
 overscan,
 gap,
 });

 const virtualItems = virtualizer.getVirtualItems();

 if (items.length === 0) {
 return null;
 }

 return (
 <div
 ref={parentRef}
 className={cn('overflow-auto will-change-scroll', className)}
 style={{ contain:'strict' }}
 >
 <div
 style={{
 height: `${virtualizer.getTotalSize()}px`,
 width:'100%',
 position:'relative',
 }}
 >
 {virtualItems.map((virtualItem) => {
 const item = items[virtualItem.index];
 const key = getItemKey 
 ? getItemKey(item, virtualItem.index) 
 : virtualItem.key;
 
 return (
 <div
 key={key}
 data-index={virtualItem.index}
 ref={virtualizer.measureElement}
 style={{
 position:'absolute',
 top: 0,
 left: 0,
 width:'100%',
 transform: `translateY(${virtualItem.start}px)`,
 }}
 >
 {renderItem(item, virtualItem.index, virtualItem)}
 </div>
 );
 })}
 </div>
 </div>
 );
}

export const VirtualList = memo(VirtualListComponent) as typeof VirtualListComponent;

interface VirtualGridProps<T> {
 items: T[];
 renderItem: (item: T, index: number) => ReactNode;
 columns: number;
 estimateRowHeight?: number;
 overscan?: number;
 className?: string;
 gap?: number;
 getItemKey?: (item: T, index: number) => string | number;
}

/**
 * Virtualized grid component for rendering large grids efficiently
 */
function VirtualGridComponent<T>({
 items,
 renderItem,
 columns,
 estimateRowHeight = 200,
 overscan = 3,
 className,
 gap = 16,
 getItemKey,
}: VirtualGridProps<T>) {
 const parentRef = useRef<HTMLDivElement>(null);
 const rowCount = Math.ceil(items.length / columns);

 const virtualizer = useVirtualizer({
 count: rowCount,
 getScrollElement: () => parentRef.current,
 estimateSize: () => estimateRowHeight,
 overscan,
 gap,
 });

 const virtualRows = virtualizer.getVirtualItems();

 if (items.length === 0) {
 return null;
 }

 return (
 <div
 ref={parentRef}
 className={cn('overflow-auto will-change-scroll', className)}
 style={{ contain:'strict' }}
 >
 <div
 style={{
 height: `${virtualizer.getTotalSize()}px`,
 width:'100%',
 position:'relative',
 }}
 >
 {virtualRows.map((virtualRow) => {
 const startIndex = virtualRow.index * columns;
 const rowItems = items.slice(startIndex, startIndex + columns);

 return (
 <div
 key={virtualRow.key}
 data-index={virtualRow.index}
 ref={virtualizer.measureElement}
 style={{
 position:'absolute',
 top: 0,
 left: 0,
 width:'100%',
 transform: `translateY(${virtualRow.start}px)`,
 display:'grid',
 gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
 gap: `${gap}px`,
 }}
 >
 {rowItems.map((item, colIndex) => {
 const itemIndex = startIndex + colIndex;
 const key = getItemKey 
 ? getItemKey(item, itemIndex) 
 : itemIndex;
 
 return (
 <div key={key}>
 {renderItem(item, itemIndex)}
 </div>
 );
 })}
 </div>
 );
 })}
 </div>
 </div>
 );
}

export const VirtualGrid = memo(VirtualGridComponent) as typeof VirtualGridComponent;

/**
 * Hook for intersection-based lazy loading
 */
export function useLazyLoad(threshold = 0.1) {
 const [isVisible, setIsVisible] = useState(false);
 const ref = useRef<HTMLDivElement>(null);

 useEffect(() => {
 const element = ref.current;
 if (!element) return;

 const observer = new IntersectionObserver(
 ([entry]) => {
 if (entry.isIntersecting) {
 setIsVisible(true);
 observer.disconnect();
 }
 },
 { threshold, rootMargin:'100px' }
 );

 observer.observe(element);
 return () => observer.disconnect();
 }, [threshold]);

 return { ref, isVisible };
}

interface LazyComponentProps {
 children: ReactNode;
 placeholder?: ReactNode;
 threshold?: number;
}

/**
 * Wrapper component for lazy loading content
 */
export function LazyComponent({ 
 children, 
 placeholder = <div className="h-32 bg-muted animate-pulse rounded-lg" />,
 threshold = 0.1,
}: LazyComponentProps) {
 const { ref, isVisible } = useLazyLoad(threshold);

 return (
 <div ref={ref}>
 {isVisible ? children : placeholder}
 </div>
 );
}