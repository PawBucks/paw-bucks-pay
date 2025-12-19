import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

type Product = {
  id: string;
  name: string;
  description?: string;
  price: number;
  price_pawbucks: number;
  category: string;
  stock_quantity: number;
  is_active: boolean;
  created_at: string;
};

export function ProductsTab() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      const filtered = products.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredProducts(filtered);
    } else {
      setFilteredProducts(products);
    }
  }, [searchTerm, products]);

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('pet_store_items')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
      setFilteredProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
      toast.error('Failed to load products');
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    setLoading(true);
    try {
      if (selectedProduct.id) {
        // Update existing product
        const { error } = await supabase
          .from('pet_store_items')
          .update({
            name: selectedProduct.name,
            description: selectedProduct.description,
            price: selectedProduct.price,
            price_pawbucks: selectedProduct.price_pawbucks,
            category: selectedProduct.category,
            stock_quantity: selectedProduct.stock_quantity,
            is_active: selectedProduct.is_active,
          })
          .eq('id', selectedProduct.id);

        if (error) throw error;

        await supabase.rpc('log_admin_action', {
          _action: 'UPDATE_PRODUCT',
          _entity_type: 'product',
          _entity_id: selectedProduct.id,
          _changes: { name: selectedProduct.name, price: selectedProduct.price },
        });
      } else {
        // Create new product
        const { error } = await supabase
          .from('pet_store_items')
          .insert([{
            name: selectedProduct.name,
            description: selectedProduct.description,
            price: selectedProduct.price,
            price_pawbucks: selectedProduct.price_pawbucks,
            category: selectedProduct.category,
            stock_quantity: selectedProduct.stock_quantity,
            is_active: selectedProduct.is_active,
          }]);

        if (error) throw error;

        await supabase.rpc('log_admin_action', {
          _action: 'CREATE_PRODUCT',
          _entity_type: 'product',
          _entity_id: null,
          _changes: { name: selectedProduct.name },
        });
      }

      toast.success(selectedProduct.id ? 'Product updated' : 'Product created');
      setEditDialogOpen(false);
      loadProducts();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      const { error } = await supabase
        .from('pet_store_items')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await supabase.rpc('log_admin_action', {
        _action: 'DELETE_PRODUCT',
        _entity_type: 'product',
        _entity_id: id,
        _changes: {},
      });

      toast.success('Product deleted');
      loadProducts();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const newProduct = () => {
    setSelectedProduct({
      id: '',
      name: '',
      description: '',
      price: 0,
      price_pawbucks: 0,
      category: 'food',
      stock_quantity: 0,
      is_active: true,
      created_at: new Date().toISOString(),
    });
    setEditDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold">Product Management</h2>
          <p className="text-muted-foreground">Manage Pet Store products</p>
        </div>
        <Button onClick={newProduct}>
          <Plus className="w-4 h-4 mr-2" />
          Add Product
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search products..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>USD Price</TableHead>
              <TableHead>PawBucks Price</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProducts.map((product) => (
              <TableRow key={product.id}>
                <TableCell className="font-medium">{product.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">{product.category}</Badge>
                </TableCell>
                <TableCell>${product.price.toLocaleString()}</TableCell>
                <TableCell>{product.price_pawbucks?.toLocaleString() || 0} PB</TableCell>
                <TableCell>{product.stock_quantity}</TableCell>
                <TableCell>
                  <Badge variant={product.is_active ? 'default' : 'secondary'}>
                    {product.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedProduct(product);
                      setEditDialogOpen(true);
                    }}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteProduct(product.id)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedProduct?.id ? 'Edit Product' : 'Add Product'}</DialogTitle>
            <DialogDescription>
              {selectedProduct?.id ? 'Update product details' : 'Create a new product'}
            </DialogDescription>
          </DialogHeader>
          {selectedProduct && (
            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Product Name</Label>
                  <Input
                    value={selectedProduct.name}
                    onChange={(e) => setSelectedProduct({ ...selectedProduct, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Input
                    value={selectedProduct.category}
                    onChange={(e) => setSelectedProduct({ ...selectedProduct, category: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>USD Price ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={selectedProduct.price}
                    onChange={(e) => setSelectedProduct({ ...selectedProduct, price: parseFloat(e.target.value) })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>PawBucks Price</Label>
                  <Input
                    type="number"
                    value={selectedProduct.price_pawbucks}
                    onChange={(e) => setSelectedProduct({ ...selectedProduct, price_pawbucks: parseInt(e.target.value) })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Stock Quantity</Label>
                  <Input
                    type="number"
                    value={selectedProduct.stock_quantity}
                    onChange={(e) => setSelectedProduct({ ...selectedProduct, stock_quantity: parseInt(e.target.value) })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={selectedProduct.description || ''}
                  onChange={(e) => setSelectedProduct({ ...selectedProduct, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={selectedProduct.is_active}
                  onChange={(e) => setSelectedProduct({ ...selectedProduct, is_active: e.target.checked })}
                />
                <Label htmlFor="is_active">Product is active</Label>
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Saving...' : selectedProduct.id ? 'Update Product' : 'Create Product'}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
