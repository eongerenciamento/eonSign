import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Copy, Percent, DollarSign, Calendar } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Coupon {
  id: string;
  name: string;
  percent_off: number | null;
  amount_off: number | null;
  currency: string | null;
  duration: string;
  duration_in_months: number | null;
  valid: boolean;
  times_redeemed: number;
  created: number;
}

export const AdminCouponsTab = () => {
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newCoupon, setNewCoupon] = useState({
    name: "",
    discountType: "percent",
    percentOff: "",
    amountOff: "",
    duration: "once",
    durationInMonths: "",
  });

  const { data: coupons, isLoading, error } = useQuery({
    queryKey: ["admin-coupons"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-list-coupons");
      if (error) throw error;
      return data as Coupon[];
    },
  });

  const createCouponMutation = useMutation({
    mutationFn: async (couponData: typeof newCoupon) => {
      const { data, error } = await supabase.functions.invoke("admin-create-coupon", {
        body: couponData,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Cupom criado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
      setShowCreateDialog(false);
      setNewCoupon({
        name: "",
        discountType: "percent",
        percentOff: "",
        amountOff: "",
        duration: "once",
        durationInMonths: "",
      });
    },
    onError: (error: Error) => {
      toast.error("Erro ao criar cupom: " + error.message);
    },
  });

  const handleCopyCoupon = (id: string) => {
    navigator.clipboard.writeText(id);
    toast.success("Código do cupom copiado!");
  };

  const handleCreateCoupon = () => {
    if (!newCoupon.name) {
      toast.error("Nome do cupom é obrigatório");
      return;
    }
    if (newCoupon.discountType === "percent" && !newCoupon.percentOff) {
      toast.error("Percentual de desconto é obrigatório");
      return;
    }
    if (newCoupon.discountType === "amount" && !newCoupon.amountOff) {
      toast.error("Valor de desconto é obrigatório");
      return;
    }
    if (newCoupon.duration === "repeating" && !newCoupon.durationInMonths) {
      toast.error("Duração em meses é obrigatória");
      return;
    }
    createCouponMutation.mutate(newCoupon);
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="text-center text-red-500 py-8">
        Erro ao carregar cupons: {(error as Error).message}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="bg-[#273d60] hover:bg-[#273d60]/90 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Novo Cupom
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Criar Novo Cupom</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Nome do Cupom</Label>
                <Input
                  value={newCoupon.name}
                  onChange={(e) => setNewCoupon({ ...newCoupon, name: e.target.value })}
                  placeholder="Ex: DESCONTO20"
                  className="bg-gray-100 border-0"
                />
              </div>

              <div className="space-y-2">
                <Label>Tipo de Desconto</Label>
                <Select
                  value={newCoupon.discountType}
                  onValueChange={(v) => setNewCoupon({ ...newCoupon, discountType: v })}
                >
                  <SelectTrigger className="bg-gray-100 border-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percentual (%)</SelectItem>
                    <SelectItem value="amount">Valor Fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {newCoupon.discountType === "percent" ? (
                <div className="space-y-2">
                  <Label>Percentual de Desconto</Label>
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={newCoupon.percentOff}
                    onChange={(e) => setNewCoupon({ ...newCoupon, percentOff: e.target.value })}
                    placeholder="Ex: 20"
                    className="bg-gray-100 border-0"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Valor do Desconto (centavos)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={newCoupon.amountOff}
                    onChange={(e) => setNewCoupon({ ...newCoupon, amountOff: e.target.value })}
                    placeholder="Ex: 5000 (R$ 50,00)"
                    className="bg-gray-100 border-0"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Duração</Label>
                <Select
                  value={newCoupon.duration}
                  onValueChange={(v) => setNewCoupon({ ...newCoupon, duration: v })}
                >
                  <SelectTrigger className="bg-gray-100 border-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="once">Uma vez</SelectItem>
                    <SelectItem value="repeating">Repetir por meses</SelectItem>
                    <SelectItem value="forever">Para sempre</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {newCoupon.duration === "repeating" && (
                <div className="space-y-2">
                  <Label>Duração em Meses</Label>
                  <Input
                    type="number"
                    min="1"
                    value={newCoupon.durationInMonths}
                    onChange={(e) => setNewCoupon({ ...newCoupon, durationInMonths: e.target.value })}
                    placeholder="Ex: 3"
                    className="bg-gray-100 border-0"
                  />
                </div>
              )}

              <Button
                onClick={handleCreateCoupon}
                disabled={createCouponMutation.isPending}
                className="w-full bg-[#273d60] hover:bg-[#273d60]/90 text-white"
              >
                {createCouponMutation.isPending ? "Criando..." : "Criar Cupom"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="bg-white shadow-md border-0">
        <CardHeader>
          <CardTitle className="text-gray-700 text-base">Cupons Ativos</CardTitle>
        </CardHeader>
        <CardContent>
          {coupons && coupons.length > 0 ? (
            <div className="space-y-3">
              {coupons.map((coupon) => (
                <div
                  key={coupon.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-full ${coupon.valid ? "bg-green-100" : "bg-gray-200"}`}>
                      {coupon.percent_off ? (
                        <Percent className={`w-5 h-5 ${coupon.valid ? "text-green-600" : "text-gray-500"}`} />
                      ) : (
                        <DollarSign className={`w-5 h-5 ${coupon.valid ? "text-green-600" : "text-gray-500"}`} />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">{coupon.name}</p>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        {coupon.percent_off ? (
                          <span>{coupon.percent_off}% de desconto</span>
                        ) : (
                          <span>R$ {((coupon.amount_off || 0) / 100).toFixed(2)} de desconto</span>
                        )}
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {coupon.duration === "once"
                            ? "Uma vez"
                            : coupon.duration === "forever"
                            ? "Para sempre"
                            : `${coupon.duration_in_months} meses`}
                        </span>
                        <span>•</span>
                        <span>{coupon.times_redeemed} usos</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyCoupon(coupon.id)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">Nenhum cupom encontrado</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
