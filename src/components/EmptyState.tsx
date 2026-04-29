import { ReactNode } from'react';
import { GradientCard } from'@/components/ui/gradient-card';
import { Button } from'@/components/ui/button';
import { LucideIcon } from'lucide-react';

interface EmptyStateProps {
 icon: LucideIcon;
 title: string;
 description: string;
 action?: {
 label: string;
 onClick: () => void;
 };
 children?: ReactNode;
}

// Reusable empty state component for better UX
export const EmptyState = ({ 
 icon: Icon, 
 title, 
 description, 
 action,
 children 
}: EmptyStateProps) => {
 return (
 <GradientCard className="text-center py-16">
 <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-6">
 <Icon className="w-10 h-10 text-muted-foreground" />
 </div>
 <h3 className="text-2xl font-bold mb-2">{title}</h3>
 <p className="text-muted-foreground mb-6 max-w-md mx-auto">{description}</p>
 {action && (
 <Button onClick={action.onClick} size="lg">
 {action.label}
 </Button>
 )}
 {children}
 </GradientCard>
 );
};
