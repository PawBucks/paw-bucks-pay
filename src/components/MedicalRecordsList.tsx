import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Download, Calendar, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

type MedicalRecord = {
  id: string;
  record_type: string;
  title: string;
  description: string | null;
  record_date: string;
  file_url: string | null;
  created_at: string;
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
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadRecords = async () => {
    try {
      const { data, error } = await supabase
        .from("pet_medical_records")
        .select("*")
        .eq("pet_id", petId)
        .order("record_date", { ascending: false });

      if (error) throw error;
      setRecords(data || []);
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

  const handleDelete = async (recordId: string, fileUrl: string | null) => {
    if (!confirm("Are you sure you want to delete this medical record?")) return;

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

      toast.success("Medical record deleted");
      loadRecords();
    } catch (error) {
      console.error("Error deleting record:", error);
      toast.error("Failed to delete medical record");
    }
  };

  const handleDownload = (fileUrl: string, title: string) => {
    window.open(fileUrl, "_blank");
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading records...</div>;
  }

  if (records.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No medical records yet. Upload your pet's health records to keep everything organized.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {records.map((record) => (
        <Card key={record.id} className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <h3 className="font-semibold truncate">{record.title}</h3>
              </div>
              
              <div className="flex flex-wrap gap-2 mb-2">
                <Badge variant="outline" className={recordTypeColors[record.record_type]}>
                  {record.record_type.replace("_", " ")}
                </Badge>
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {format(new Date(record.record_date), "MMM d, yyyy")}
                </span>
              </div>

              {record.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {record.description}
                </p>
              )}
            </div>

            <div className="flex gap-2 flex-shrink-0">
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
                variant="outline"
                onClick={() => handleDelete(record.id, record.file_url)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};
