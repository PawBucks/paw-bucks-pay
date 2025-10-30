import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type MedicalRecord = {
  id: string;
  visit_id: string | null;
  record_type: string;
  title: string;
  description: string | null;
  record_date: string;
  file_url: string | null;
  quantity: number | null;
  price: number | null;
  created_at: string;
};

type Visit = {
  id: string;
  visit_date: string;
  notes: string | null;
  vet_name: string | null;
  doctor_name: string | null;
  records: MedicalRecord[];
};

type MedicalRecordsListProps = {
  petId: string;
  refreshTrigger?: number;
};

const recordTypeColors: Record<string, string> = {
  vaccination: "bg-green-500/10 text-green-700 border-green-500/20",
  checkup: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  surgery: "bg-red-500/10 text-red-700 border-red-500/20",
  lab_results: "bg-purple-500/10 text-purple-700 border-purple-500/20",
  prescription: "bg-orange-500/10 text-orange-700 border-orange-500/20",
  dental: "bg-cyan-500/10 text-cyan-700 border-cyan-500/20",
  emergency: "bg-pink-500/10 text-pink-700 border-pink-500/20",
  other: "bg-gray-500/10 text-gray-700 border-gray-500/20",
};

export const MedicalRecordsList = ({ petId, refreshTrigger }: MedicalRecordsListProps) => {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [expandedVisits, setExpandedVisits] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  const loadRecords = async () => {
    try {
      // Load all visits
      const { data: visitsData, error: visitsError } = await supabase
        .from("pet_medical_visits")
        .select("id, visit_date, notes, vet_name, doctor_name")
        .eq("pet_id", petId)
        .order("visit_date", { ascending: false });

      if (visitsError) throw visitsError;

      // Load all records
      const { data: recordsData, error: recordsError } = await supabase
        .from("pet_medical_records")
        .select("*")
        .eq("pet_id", petId)
        .order("created_at", { ascending: true });

      if (recordsError) throw recordsError;

      // Group records by visit
      const groupedVisits: Visit[] = (visitsData || []).map(visit => ({
        id: visit.id,
        visit_date: visit.visit_date,
        notes: visit.notes,
        vet_name: visit.vet_name,
        doctor_name: visit.doctor_name,
        records: (recordsData || []).filter(r => r.visit_id === visit.id),
      }));

      setVisits(groupedVisits);
    } catch (error) {
      console.error("Error loading medical records:", error);
      toast.error("Failed to load medical records");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, [petId, refreshTrigger]);

  const toggleVisit = (visitId: string) => {
    setExpandedVisits(prev => {
      const newSet = new Set(prev);
      if (newSet.has(visitId)) {
        newSet.delete(visitId);
      } else {
        newSet.add(visitId);
      }
      return newSet;
    });
  };

  const handleDeleteVisit = async (visitId: string) => {
    if (!confirm("Are you sure you want to delete this entire visit and all its records?")) return;

    try {
      // Get all records for this visit to delete their files
      const { data: records } = await supabase
        .from("pet_medical_records")
        .select("file_url")
        .eq("visit_id", visitId);

      // Delete files from storage
      if (records) {
        const filesToDelete = records
          .filter(r => r.file_url)
          .map(r => r.file_url!.split("/medical-records/")[1])
          .filter(Boolean);

        if (filesToDelete.length > 0) {
          await supabase.storage.from("medical-records").remove(filesToDelete);
        }
      }

      // Delete visit (cascade will delete records)
      const { error } = await supabase
        .from("pet_medical_visits")
        .delete()
        .eq("id", visitId);

      if (error) throw error;

      toast.success("Visit and all records deleted");
      loadRecords();
    } catch (error) {
      console.error("Error deleting visit:", error);
      toast.error("Failed to delete visit");
    }
  };

  const handleDeleteRecord = async (recordId: string, fileUrl: string | null) => {
    if (!confirm("Are you sure you want to delete this record?")) return;

    try {
      // Delete file from storage if exists
      if (fileUrl) {
        const filePath = fileUrl.split("/medical-records/")[1];
        if (filePath) {
          await supabase.storage.from("medical-records").remove([filePath]);
        }
      }

      // Delete record from database
      const { error } = await supabase
        .from("pet_medical_records")
        .delete()
        .eq("id", recordId);

      if (error) throw error;

      toast.success("Record deleted");
      loadRecords();
    } catch (error) {
      console.error("Error deleting record:", error);
      toast.error("Failed to delete record");
    }
  };

  const handleDownload = (fileUrl: string, title: string) => {
    window.open(fileUrl, "_blank");
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading records...</div>;
  }

  if (visits.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No medical visits yet. Add a visit to track your pet's health records.
      </div>
    );
  }

  const calculateVisitTotal = (records: MedicalRecord[]) => {
    return records.reduce((sum, record) => sum + (Number(record.price) || 0), 0);
  };

  return (
    <div className="space-y-4">
      {visits.map((visit) => {
        const isExpanded = expandedVisits.has(visit.id);
        const totalCost = calculateVisitTotal(visit.records);

        return (
          <Card key={visit.id} className="overflow-hidden">
            <Collapsible open={isExpanded} onOpenChange={() => toggleVisit(visit.id)}>
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between p-4 hover:bg-accent/50 transition-colors">
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    )}
                    <div className="text-left">
                      <div className="font-semibold">
                        {format(new Date(visit.visit_date), "MMMM d, yyyy")}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {visit.records.length} item{visit.records.length !== 1 ? 's' : ''}
                        {totalCost > 0 && ` • Total: $${totalCost.toFixed(2)}`}
                      </div>
                      {(visit.vet_name || visit.doctor_name) && (
                        <div className="text-sm text-muted-foreground mt-1">
                          {visit.vet_name && <span>{visit.vet_name}</span>}
                          {visit.vet_name && visit.doctor_name && <span> • </span>}
                          {visit.doctor_name && <span>{visit.doctor_name}</span>}
                        </div>
                      )}
                      {visit.notes && (
                        <div className="text-sm text-muted-foreground mt-1 line-clamp-1">
                          {visit.notes}
                        </div>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteVisit(visit.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="border-t">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visit.records.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium">{record.title}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={recordTypeColors[record.record_type]}>
                              {record.record_type.replace("_", " ")}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{record.quantity || "-"}</TableCell>
                          <TableCell className="text-right">
                            {record.price ? `$${Number(record.price).toFixed(2)}` : "-"}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {record.description || "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              {record.file_url && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDownload(record.file_url!, record.title)}
                                >
                                  <Download className="w-4 h-4" />
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteRecord(record.id, record.file_url)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        );
      })}
    </div>
  );
};
