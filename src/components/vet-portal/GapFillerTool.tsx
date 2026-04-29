import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Search, Send, Gift, AlertTriangle, Calendar, Dog, Cat } from "lucide-react";
import { format, differenceInDays } from "date-fns";

interface GapFillerToolProps {
  vetId: string;
}

interface OverduePatient {
  id: string;
  petId: string;
  petName: string;
  petSpecies: string;
  ownerName: string;
  ownerId: string;
  ownerEmail: string;
  serviceType: string;
  dueDate: string;
  daysOverdue: number;
  lastVisit: string | null;
}

export function GapFillerTool({ vetId }: GapFillerToolProps) {
  const [overduePatients, setOverduePatients] = useState<OverduePatient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPatients, setSelectedPatients] = useState<Set<string>>(new Set());
  const [filterService, setFilterService] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSendingOffers, setIsSendingOffers] = useState(false);
  const [showOfferDialog, setShowOfferDialog] = useState(false);
  const [bonusAmount, setBonusAmount] = useState(500);
  const [offerMessage, setOfferMessage] = useState("");

  useEffect(() => {
    loadOverduePatients();
  }, [vetId]);

  const loadOverduePatients = async () => {
    try {
      // Get overdue compliance reminders
      const { data: reminders, error: remindersError } = await supabase
        .from("compliance_reminders")
        .select(`
          id,
          pet_id,
          reminder_type,
          title,
          due_date,
          pet_profiles!inner(
            id,
            name,
            species,
            user_id,
            profiles!inner(id, full_name, email)
          )
        `)
        .eq("vet_id", vetId)
        .eq("is_active", true)
        .lt("due_date", new Date().toISOString().split("T")[0]);

      if (remindersError) throw remindersError;

      // Get last visits for each pet
      const petIds = [...new Set((reminders || []).map(r => r.pet_id))];
      const { data: visits } = await supabase
        .from("pet_medical_visits")
        .select("pet_id, visit_date")
        .in("pet_id", petIds)
        .order("visit_date", { ascending: false });

      const lastVisitMap = new Map<string, string>();
      (visits || []).forEach(v => {
        if (!lastVisitMap.has(v.pet_id)) {
          lastVisitMap.set(v.pet_id, v.visit_date);
        }
      });

      const patients: OverduePatient[] = (reminders || []).map(r => {
        const pet = r.pet_profiles as any;
        const owner = pet.profiles;
        const dueDate = new Date(r.due_date);
        const daysOverdue = differenceInDays(new Date(), dueDate);

        return {
          id: r.id,
          petId: pet.id,
          petName: pet.name,
          petSpecies: pet.species,
          ownerName: owner.full_name || "Unknown",
          ownerId: owner.id,
          ownerEmail: owner.email,
          serviceType: r.reminder_type,
          dueDate: r.due_date,
          daysOverdue,
          lastVisit: lastVisitMap.get(pet.id) || null,
        };
      });

      // Sort by days overdue (most overdue first)
      patients.sort((a, b) => b.daysOverdue - a.daysOverdue);
      setOverduePatients(patients);
    } catch (error) {
      console.error("Error loading overdue patients:", error);
      toast.error("Failed to load overdue patients");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredPatients = overduePatients.filter(p => {
    const matchesService = filterService === "all" || p.serviceType === filterService;
    const matchesSearch = searchQuery === "" || 
      p.petName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.ownerName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesService && matchesSearch;
  });

  const serviceTypes = [...new Set(overduePatients.map(p => p.serviceType))];

  const togglePatientSelection = (id: string) => {
    const newSelected = new Set(selectedPatients);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedPatients(newSelected);
  };

  const selectAll = () => {
    if (selectedPatients.size === filteredPatients.length) {
      setSelectedPatients(new Set());
    } else {
      setSelectedPatients(new Set(filteredPatients.map(p => p.id)));
    }
  };

  const sendBonusOffers = async () => {
    if (selectedPatients.size === 0) {
      toast.error("Please select at least one patient");
      return;
    }

    setIsSendingOffers(true);
    try {
      const selectedList = filteredPatients.filter(p => selectedPatients.has(p.id));
      
      // Create bonus offers for each selected patient
      const offers = selectedList.map(p => ({
        vet_id: vetId,
        pet_id: p.petId,
        user_id: p.ownerId,
        service_type: p.serviceType,
        bonus_amount: bonusAmount,
        message: offerMessage || `We noticed ${p.petName} is overdue for ${p.serviceType}. Book now and receive ${bonusAmount} bonus PawBucks!`,
        status: "sent",
      }));

      const { error } = await supabase
        .from("vet_bonus_offers")
        .insert(offers);

      if (error) throw error;

      // Create notifications for pet owners
      for (const patient of selectedList) {
        await supabase.from("notifications").insert({
          user_id: patient.ownerId,
          title: "🎁 Bonus PawBucks Offer!",
          message: offerMessage || `${patient.petName} is overdue for ${patient.serviceType}. Book now and receive ${bonusAmount} bonus PawBucks!`,
          category: "promotional",
        });
      }

      toast.success(`Sent ${selectedList.length} bonus offers successfully!`);
      setSelectedPatients(new Set());
      setShowOfferDialog(false);
      setOfferMessage("");
    } catch (error) {
      console.error("Error sending bonus offers:", error);
      toast.error("Failed to send bonus offers");
    } finally {
      setIsSendingOffers(false);
    }
  };

  const getServiceBadgeColor = (service: string) => {
    switch (service.toLowerCase()) {
      case "vaccination": return "bg-info/10 text-info /30 ";
      case "dental": return "bg-primary/10 text-primary /30 ";
      case "exam": return "bg-success/10 text-success /30 ";
      case "heartworm": return "bg-destructive/10 text-destructive /30 ";
      default: return "bg-muted text-muted-foreground /30 ";
    }
  };

  const getUrgencyColor = (daysOverdue: number) => {
    if (daysOverdue > 90) return "text-destructive ";
    if (daysOverdue > 30) return "text-warning ";
    return "text-warning dark:text-yellow-400";
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Gap Filler - Overdue Services
          </CardTitle>
          <CardDescription>
            Identify patients overdue for services and send targeted PawBucks bonus offers to encourage bookings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-muted/50">
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-warning">{overduePatients.length}</p>
                <p className="text-sm text-muted-foreground">Total Overdue</p>
              </CardContent>
            </Card>
            <Card className="bg-muted/50">
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-destructive">
                  {overduePatients.filter(p => p.daysOverdue > 90).length}
                </p>
                <p className="text-sm text-muted-foreground">Critical (90+ days)</p>
              </CardContent>
            </Card>
            <Card className="bg-muted/50">
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-primary">
                  {overduePatients.filter(p => p.serviceType === "dental").length}
                </p>
                <p className="text-sm text-muted-foreground">Dentals Overdue</p>
              </CardContent>
            </Card>
            <Card className="bg-muted/50">
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-info">
                  {overduePatients.filter(p => p.serviceType === "vaccination").length}
                </p>
                <p className="text-sm text-muted-foreground">Vaccines Overdue</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by pet or owner name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterService} onValueChange={setFilterService}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by service" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Services</SelectItem>
                {serviceTypes.map(service => (
                  <SelectItem key={service} value={service}>
                    {service.charAt(0).toUpperCase() + service.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Dialog open={showOfferDialog} onOpenChange={setShowOfferDialog}>
              <DialogTrigger asChild>
                <Button disabled={selectedPatients.size === 0}>
                  <Gift className="h-4 w-4 mr-2" />
                  Send Bonus Offer ({selectedPatients.size})
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Send PawBucks Bonus Offer</DialogTitle>
                  <DialogDescription>
                    Send a targeted bonus offer to {selectedPatients.size} selected pet owners
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Bonus Amount (PawBucks)</Label>
                    <Select value={bonusAmount.toString()} onValueChange={(v) => setBonusAmount(parseInt(v))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="250">250 PawBucks ($0.25 value)</SelectItem>
                        <SelectItem value="500">500 PawBucks ($0.50 value)</SelectItem>
                        <SelectItem value="1000">1,000 PawBucks ($1.00 value)</SelectItem>
                        <SelectItem value="2500">2,500 PawBucks ($2.50 value)</SelectItem>
                        <SelectItem value="5000">5,000 PawBucks ($5.00 value)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Custom Message (optional)</Label>
                    <Textarea
                      placeholder="Leave blank for auto-generated message based on overdue service..."
                      value={offerMessage}
                      onChange={(e) => setOfferMessage(e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowOfferDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={sendBonusOffers} disabled={isSendingOffers}>
                    {isSendingOffers ? "Sending..." : "Send Offers"}
                    <Send className="h-4 w-4 ml-2" />
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Patient Table */}
          {filteredPatients.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No overdue patients found</p>
              <p className="text-sm">Great job keeping up with patient care!</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedPatients.size === filteredPatients.length && filteredPatients.length > 0}
                        onCheckedChange={selectAll}
                      />
                    </TableHead>
                    <TableHead>Pet</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Overdue</TableHead>
                    <TableHead>Last Visit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPatients.map((patient) => (
                    <TableRow key={patient.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedPatients.has(patient.id)}
                          onCheckedChange={() => togglePatientSelection(patient.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {patient.petSpecies === "dog" ? (
                            <Dog className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Cat className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="font-medium">{patient.petName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{patient.ownerName}</p>
                          <p className="text-xs text-muted-foreground">{patient.ownerEmail}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getServiceBadgeColor(patient.serviceType)}>
                          {patient.serviceType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(patient.dueDate), "MMM d, yyyy")}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`font-bold ${getUrgencyColor(patient.daysOverdue)}`}>
                          {patient.daysOverdue} days
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {patient.lastVisit 
                          ? format(new Date(patient.lastVisit), "MMM d, yyyy")
                          : "No visits"
                        }
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
