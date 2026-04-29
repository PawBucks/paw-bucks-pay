import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Gift, Tag, Clock, Package, Sparkles, AlertCircle } from "lucide-react";
import { format } from "date-fns";

type BadgeDefinition = {
  id: string;
  badge_key: string;
  name: string;
  emoji: string;
  category: string;
};

type PetStoreItem = {
  id: string;
  name: string;
  category: string;
  price: number;
  price_pawbucks: number;
  is_active: boolean;
};

type BadgePromotion = {
  id: string;
  badge_id: string;
  name: string;
  description: string | null;
  discount_percentage: number;
  duration_hours: number;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  guilt_badge_definitions?: BadgeDefinition;
  badge_promotion_items?: { item_id: string }[];
};

export function BadgePromotionsTab() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<BadgePromotion | null>(null);
  const [formData, setFormData] = useState({
    badge_id: "",
    name: "",
    description: "",
    discount_percentage: 10,
    duration_hours: 48,
    is_active: true,
    selected_items: [] as string[],
  });

  // Fetch badge definitions
  const { data: badges } = useQuery({
    queryKey: ["guilt-badge-definitions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guilt_badge_definitions")
        .select("id, badge_key, name, emoji, category")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data as BadgeDefinition[];
    },
  });

  // Fetch pet store items
  const { data: storeItems } = useQuery({
    queryKey: ["pet-store-items-admin-promo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pet_store_items")
        .select("id, name, category, price, price_pawbucks, is_active")
        .order("category", { ascending: true });
      if (error) throw error;
      return data as PetStoreItem[];
    },
  });

  // Fetch existing promotions
  const { data: promotions, isLoading } = useQuery({
    queryKey: ["badge-promotions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("badge_promotions")
        .select(`
          *,
          guilt_badge_definitions (id, badge_key, name, emoji, category),
          badge_promotion_items (item_id)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as BadgePromotion[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Create promotion
      const { data: promotion, error } = await supabase
        .from("badge_promotions")
        .insert([{
          badge_id: data.badge_id,
          name: data.name,
          description: data.description || null,
          discount_percentage: data.discount_percentage,
          duration_hours: data.duration_hours,
          is_active: data.is_active,
        }])
        .select()
        .single();
      
      if (error) throw error;

      // Add promotion items
      if (data.selected_items.length > 0) {
        const items = data.selected_items.map(item_id => ({
          promotion_id: promotion.id,
          item_id,
        }));
        const { error: itemsError } = await supabase
          .from("badge_promotion_items")
          .insert(items);
        if (itemsError) throw itemsError;
      }

      return promotion;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["badge-promotions"] });
      toast.success("Promotion created successfully!");
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create promotion");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      // Update promotion
      const { error } = await supabase
        .from("badge_promotions")
        .update({
          badge_id: data.badge_id,
          name: data.name,
          description: data.description || null,
          discount_percentage: data.discount_percentage,
          duration_hours: data.duration_hours,
          is_active: data.is_active,
        })
        .eq("id", id);
      
      if (error) throw error;

      // Remove existing items
      await supabase.from("badge_promotion_items").delete().eq("promotion_id", id);

      // Add new items
      if (data.selected_items.length > 0) {
        const items = data.selected_items.map(item_id => ({
          promotion_id: id,
          item_id,
        }));
        const { error: itemsError } = await supabase
          .from("badge_promotion_items")
          .insert(items);
        if (itemsError) throw itemsError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["badge-promotions"] });
      toast.success("Promotion updated successfully!");
      setIsDialogOpen(false);
      setEditingPromotion(null);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update promotion");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("badge_promotions")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["badge-promotions"] });
      toast.success("Promotion deleted");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete promotion");
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("badge_promotions")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["badge-promotions"] });
      toast.success("Promotion status updated");
    },
  });

  const resetForm = () => {
    setFormData({
      badge_id: "",
      name: "",
      description: "",
      discount_percentage: 10,
      duration_hours: 48,
      is_active: true,
      selected_items: [],
    });
  };

  const handleEdit = (promotion: BadgePromotion) => {
    setEditingPromotion(promotion);
    setFormData({
      badge_id: promotion.badge_id,
      name: promotion.name,
      description: promotion.description || "",
      discount_percentage: promotion.discount_percentage,
      duration_hours: promotion.duration_hours,
      is_active: promotion.is_active,
      selected_items: promotion.badge_promotion_items?.map(i => i.item_id) || [],
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.selected_items.length === 0) {
      toast.error("Please select at least one item for the promotion");
      return;
    }
    if (editingPromotion) {
      updateMutation.mutate({ id: editingPromotion.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this promotion?")) {
      deleteMutation.mutate(id);
    }
  };

  const toggleItemSelection = (itemId: string) => {
    setFormData(prev => ({
      ...prev,
      selected_items: prev.selected_items.includes(itemId)
        ? prev.selected_items.filter(id => id !== itemId)
        : [...prev.selected_items, itemId],
    }));
  };

  const selectedBadge = badges?.find(b => b.id === formData.badge_id);
  const itemsByCategory = storeItems?.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, PetStoreItem[]>) || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Guilt-Free Splurge Promotions
          </h2>
          <p className="text-muted-foreground">
            Create and manage promotional discounts for badge earners on Pet Store items
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingPromotion(null);
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Promotion
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>
                {editingPromotion ? "Edit Promotion" : "Create New Promotion"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-6 py-4">
                  {/* Badge Selection */}
                  <div className="space-y-2">
                    <Label>Select Badge</Label>
                    <Select
                      value={formData.badge_id}
                      onValueChange={(value) => setFormData({ ...formData, badge_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a badge..." />
                      </SelectTrigger>
                      <SelectContent>
                        {badges?.map((badge) => (
                          <SelectItem key={badge.id} value={badge.id}>
                            <span className="flex items-center gap-2">
                              <span>{badge.emoji}</span>
                              <span>{badge.name}</span>
                              <Badge variant="outline" className="text-xs">{badge.category}</Badge>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedBadge && (
                      <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
                        <span className="text-2xl">{selectedBadge.emoji}</span>
                        <div>
                          <p className="font-medium">{selectedBadge.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Users who earn this badge will unlock the promotion
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Promotion Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Promotion Name</Label>
                      <Input
                        id="name"
                        required
                        placeholder="e.g., Treat Bandit Exclusive"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                    <div className="flex items-center gap-4 pt-6">
                      <Checkbox
                        id="is_active"
                        checked={formData.is_active}
                        onCheckedChange={(checked) => 
                          setFormData({ ...formData, is_active: checked as boolean })
                        }
                      />
                      <Label htmlFor="is_active" className="cursor-pointer">
                        Active (visible to badge earners)
                      </Label>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description (optional)</Label>
                    <Textarea
                      id="description"
                      placeholder="Describe the promotion..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={2}
                    />
                  </div>

                  {/* Discount & Duration */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <Label className="flex items-center gap-2">
                          <Tag className="h-4 w-4" />
                          Discount Percentage
                        </Label>
                        <span className="text-2xl font-bold text-primary">
                          {formData.discount_percentage}%
                        </span>
                      </div>
                      <Slider
                        value={[formData.discount_percentage]}
                        onValueChange={([value]) => 
                          setFormData({ ...formData, discount_percentage: value })
                        }
                        min={5}
                        max={50}
                        step={5}
                        className="w-full"
                      />
                      <p className="text-xs text-muted-foreground">
                        Discount off regular price (5% - 50%)
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <Label className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Duration
                        </Label>
                        <span className="text-2xl font-bold text-primary">
                          {formData.duration_hours}hrs
                        </span>
                      </div>
                      <Slider
                        value={[formData.duration_hours]}
                        onValueChange={([value]) => 
                          setFormData({ ...formData, duration_hours: value })
                        }
                        min={24}
                        max={72}
                        step={12}
                        className="w-full"
                      />
                      <p className="text-xs text-muted-foreground">
                        How long the promotion lasts after badge earned (24-72 hrs)
                      </p>
                    </div>
                  </div>

                  {/* Item Selection */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <Label className="flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        Select Pet Store Items
                      </Label>
                      <Badge variant="outline">
                        {formData.selected_items.length} selected
                      </Badge>
                    </div>
                    
                    {formData.selected_items.length === 0 && (
                      <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg border border-destructive/20">
                        <AlertCircle className="h-4 w-4" />
                        <p className="text-sm">Select at least one item for the promotion</p>
                      </div>
                    )}

                    <div className="border rounded-lg max-h-64 overflow-y-auto">
                      {Object.entries(itemsByCategory).map(([category, items]) => (
                        <div key={category}>
                          <div className="sticky top-0 bg-muted px-3 py-2 font-medium text-sm border-b">
                            {category}
                          </div>
                          {items.map((item) => (
                            <div
                              key={item.id}
                              className={`flex items-center gap-3 px-3 py-2 border-b last:border-b-0 cursor-pointer hover:bg-accent/50 transition-colors ${
                                formData.selected_items.includes(item.id) ? "bg-primary/10" : ""
                              }`}
                              onClick={() => toggleItemSelection(item.id)}
                            >
                              <Checkbox
                                checked={formData.selected_items.includes(item.id)}
                                onCheckedChange={() => toggleItemSelection(item.id)}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{item.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  ${(item.price / 100).toFixed(2)} • {item.price_pawbucks} PB
                                </p>
                              </div>
                              {formData.selected_items.includes(item.id) && (
                                <div className="text-right">
                                  <p className="text-sm font-medium text-primary">
                                    ${((item.price / 100) * (1 - formData.discount_percentage / 100)).toFixed(2)}
                                  </p>
                                  <p className="text-xs text-muted-foreground line-through">
                                    ${(item.price / 100).toFixed(2)}
                                  </p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollArea>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editingPromotion ? "Update" : "Create"} Promotion
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Promotions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {promotions?.filter(p => p.is_active).length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Promotions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {promotions?.length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Items on Sale
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(promotions?.flatMap(p => p.badge_promotion_items?.map(i => i.item_id) || [])).size}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Promotions Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Promotions</CardTitle>
          <CardDescription>
            Manage promotional discounts linked to Guilt-Free Splurge badges
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading promotions...</div>
          ) : promotions?.length === 0 ? (
            <div className="text-center py-12">
              <Gift className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No promotions yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first promotion to reward badge earners with Pet Store discounts
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create First Promotion
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Badge</TableHead>
                    <TableHead>Promotion</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {promotions?.map((promo) => (
                    <TableRow key={promo.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-xl">
                            {promo.guilt_badge_definitions?.emoji}
                          </span>
                          <span className="font-medium">
                            {promo.guilt_badge_definitions?.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{promo.name}</p>
                          {promo.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {promo.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-bold">
                          {promo.discount_percentage}% OFF
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1 text-sm">
                          <Clock className="h-3 w-3" />
                          {promo.duration_hours}hrs
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {promo.badge_promotion_items?.length || 0} items
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleActiveMutation.mutate({
                            id: promo.id,
                            is_active: !promo.is_active,
                          })}
                          className={promo.is_active 
                            ? "text-success hover:text-success" 
                            : "text-muted-foreground hover:text-foreground"
                          }
                        >
                          {promo.is_active ? "Active" : "Inactive"}
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(promo)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(promo.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
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
