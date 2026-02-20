import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SubmitTicketForm } from './SubmitTicketForm';
import { MyTicketsTab } from './MyTicketsTab';
import { Send, Ticket } from 'lucide-react';
import { useState } from 'react';

interface SupportTabProps {
  submitterType: 'merchant' | 'vet';
  entityId?: string;
}

export const SupportTab = ({ submitterType, entityId }: SupportTabProps) => {
  const [activeTab, setActiveTab] = useState('submit');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Support Center</h2>
        <p className="text-muted-foreground">Submit and track support tickets</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="submit" className="flex items-center gap-2">
            <Send className="w-4 h-4" />
            Submit Ticket
          </TabsTrigger>
          <TabsTrigger value="tickets" className="flex items-center gap-2">
            <Ticket className="w-4 h-4" />
            My Tickets
          </TabsTrigger>
        </TabsList>

        <TabsContent value="submit">
          <SubmitTicketForm
            submitterType={submitterType}
            entityId={entityId}
            onTicketCreated={() => setActiveTab('tickets')}
          />
        </TabsContent>

        <TabsContent value="tickets">
          <MyTicketsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};
