import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FlaskConical, Plus, Loader2, FileText, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import type { LabResult } from "./types";

interface LabResultsTabProps {
  petId: string;
  vetId: string;
}

const testTypes = [
  "CBC (Complete Blood Count)",
  "Chemistry Panel",
  "Urinalysis",
  "Fecal Analysis",
  "Thyroid Panel",
  "Heartworm Test",
  "FeLV/FIV Test",
  "Cytology",
  "Biopsy",
  "Culture & Sensitivity",
  "Other",
];

export const LabResultsTab = ({ petId, vetId }: LabResultsTabProps) => {
  const [results, setResults] = useState<LabResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    test_date: new Date().toISOString().split("T")[0],
    test_type: "",
    test_category: "blood",
    lab_name: "",
    result_summary: "",
    interpretation: "",
    abnormal_flags: "",
    notes: "",
  });

  useEffect(() => {
    loadResults();
  }, [petId]);

  const loadResults = async () => {
    try {
      const { data, error } = await supabase
        .from("pet_lab_results")
        .select("*")
        .eq("pet_id", petId)
        .order("test_date", { ascending: false });

      if (error) throw error;
      setResults((data as LabResult[]) || []);
    } catch (error) {
      console.error("Error loading lab results:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.test_type || !formData.result_summary) {
      toast.error("Please fill in required fields");
      return;
    }

    setIsSubmitting(true);
    try {
      let fileUrl = null;

      // Upload file if selected
      if (selectedFile) {
        const fileExt = selectedFile.name.split(".").pop();
        const fileName = `${petId}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("medical-records")
          .upload(fileName, selectedFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("medical-records")
          .getPublicUrl(fileName);

        fileUrl = publicUrl;
      }

      const { error } = await supabase.from("pet_lab_results").insert({
        pet_id: petId,
        vet_id: vetId,
        test_date: formData.test_date,
        test_type: formData.test_type,
        test_category: formData.test_category,
        lab_name: formData.lab_name || null,
        result_summary: formData.result_summary,
        interpretation: formData.interpretation || null,
        abnormal_flags: formData.abnormal_flags
          ? formData.abnormal_flags.split(",").map((s) => s.trim())
          : null,
        notes: formData.notes || null,
        file_url: fileUrl,
        status: "completed",
        results: {},
      });

      if (error) throw error;
      toast.success("Lab results saved");
      setDialogOpen(false);
      loadResults();
      setSelectedFile(null);
      setFormData({
        test_date: new Date().toISOString().split("T")[0],
        test_type: "",
        test_category: "blood",
        lab_name: "",
        result_summary: "",
        interpretation: "",
        abnormal_flags: "",
        notes: "",
      });
    } catch (error: any) {
      console.error("Error saving lab results:", error);
      toast.error(error.message || "Failed to save lab results");
    } finally {
      setIsSubmitting(false);
    }
  };

  const markAsReviewed = async (resultId: string) => {
    try {
      const { error } = await supabase
        .from("pet_lab_results")
        .update({
          status: "reviewed",
          reviewed_by: vetId,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", resultId);

      if (error) throw error;
      loadResults();
      toast.success("Marked as reviewed");
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "reviewed":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "completed":
        return <AlertCircle className="w-4 h-4 text-amber-500" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading lab results...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Lab Results
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Lab Results</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="test_type">Test Type *</Label>
                  <Select
                    value={formData.test_type}
                    onValueChange={(value) => setFormData({ ...formData, test_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select test type" />
                    </SelectTrigger>
                    <SelectContent>
                      {testTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="test_category">Category</Label>
                  <Select
                    value={formData.test_category}
                    onValueChange={(value) => setFormData({ ...formData, test_category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="blood">Blood</SelectItem>
                      <SelectItem value="urine">Urine</SelectItem>
                      <SelectItem value="fecal">Fecal</SelectItem>
                      <SelectItem value="tissue">Tissue</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="test_date">Test Date *</Label>
                  <Input
                    id="test_date"
                    type="date"
                    value={formData.test_date}
                    onChange={(e) => setFormData({ ...formData, test_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="lab_name">Lab Name</Label>
                  <Input
                    id="lab_name"
                    value={formData.lab_name}
                    onChange={(e) => setFormData({ ...formData, lab_name: e.target.value })}
                    placeholder="e.g., IDEXX, Antech"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="result_summary">Result Summary *</Label>
                <Textarea
                  id="result_summary"
                  value={formData.result_summary}
                  onChange={(e) => setFormData({ ...formData, result_summary: e.target.value })}
                  placeholder="Summarize the key findings from the lab results..."
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="abnormal_flags">Abnormal Values</Label>
                <Input
                  id="abnormal_flags"
                  value={formData.abnormal_flags}
                  onChange={(e) => setFormData({ ...formData, abnormal_flags: e.target.value })}
                  placeholder="Comma-separated (e.g., WBC High, BUN Elevated)"
                />
              </div>
              <div>
                <Label htmlFor="interpretation">Interpretation</Label>
                <Textarea
                  id="interpretation"
                  value={formData.interpretation}
                  onChange={(e) => setFormData({ ...formData, interpretation: e.target.value })}
                  placeholder="Clinical interpretation of the results..."
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="file">Attach Lab Report (PDF/Image)</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                />
                {selectedFile && (
                  <p className="text-sm text-muted-foreground mt-1">{selectedFile.name}</p>
                )}
              </div>
              <div>
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Any additional notes..."
                  rows={2}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {results.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          <FlaskConical className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No lab results recorded.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {results.map((result) => (
            <Card key={result.id} className="overflow-hidden">
              <Accordion type="single" collapsible>
                <AccordionItem value={result.id} className="border-none">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-accent/50">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(result.status)}
                        <div className="text-left">
                          <p className="font-semibold">{result.test_type}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(result.test_date), "MMMM d, yyyy")}
                            {result.lab_name && ` • ${result.lab_name}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {result.abnormal_flags && result.abnormal_flags.length > 0 && (
                          <Badge variant="outline" className="border-amber-500 text-amber-500">
                            {result.abnormal_flags.length} Abnormal
                          </Badge>
                        )}
                        <Badge
                          variant={result.status === "reviewed" ? "default" : "secondary"}
                          className="capitalize"
                        >
                          {result.status}
                        </Badge>
                        {result.file_url && (
                          <FileText className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="space-y-4">
                      <div>
                        <strong>Results Summary:</strong>
                        <p className="text-sm mt-1">{result.result_summary}</p>
                      </div>
                      {result.abnormal_flags && result.abnormal_flags.length > 0 && (
                        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                          <strong className="text-amber-700 dark:text-amber-400">Abnormal Values:</strong>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {result.abnormal_flags.map((flag, idx) => (
                              <Badge key={idx} variant="outline" className="border-amber-500">
                                {flag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {result.interpretation && (
                        <div>
                          <strong>Interpretation:</strong>
                          <p className="text-sm mt-1">{result.interpretation}</p>
                        </div>
                      )}
                      {result.notes && (
                        <div>
                          <strong>Notes:</strong>
                          <p className="text-sm mt-1">{result.notes}</p>
                        </div>
                      )}
                      <div className="flex gap-2">
                        {result.file_url && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(result.file_url!, "_blank")}
                          >
                            <FileText className="w-4 h-4 mr-2" />
                            View Report
                          </Button>
                        )}
                        {result.status !== "reviewed" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => markAsReviewed(result.id)}
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Mark as Reviewed
                          </Button>
                        )}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
