import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Award, 
  Clock, 
  CheckCircle, 
  FileUp, 
  Video, 
  AlertCircle,
  RefreshCw,
  ExternalLink
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface CertificateRequest {
  id: string;
  protocol: string | null;
  type: string;
  status: string;
  common_name: string;
  cpf: string;
  email: string;
  phone: string;
  birth_date: string;
  cnpj: string | null;
  responsible_name: string | null;
  videoconference_completed: boolean | null;
  certificate_issued: boolean | null;
  certificate_downloaded: boolean | null;
  created_at: string;
  updated_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: "Aguardando Documentos", color: "bg-yellow-100 text-yellow-800 border-yellow-300", icon: FileUp },
  documents_sent: { label: "Documentos Enviados", color: "bg-blue-100 text-blue-800 border-blue-300", icon: Clock },
  videoconference_scheduled: { label: "Videoconferência Agendada", color: "bg-purple-100 text-purple-800 border-purple-300", icon: Video },
  videoconference_completed: { label: "Videoconferência Concluída", color: "bg-indigo-100 text-indigo-800 border-indigo-300", icon: CheckCircle },
  approved: { label: "Aprovado", color: "bg-green-100 text-green-800 border-green-300", icon: CheckCircle },
  issued: { label: "Certificado Emitido", color: "bg-emerald-100 text-emerald-800 border-emerald-300", icon: Award },
  rejected: { label: "Rejeitado", color: "bg-red-100 text-red-800 border-red-300", icon: AlertCircle },
};

const STEPS = [
  { key: "request", label: "Solicitação", icon: Award },
  { key: "documents", label: "Documentos", icon: FileUp },
  { key: "videoconference", label: "Videoconferência", icon: Video },
  { key: "emission", label: "Emissão", icon: CheckCircle },
];

function getStepStatus(request: CertificateRequest) {
  const steps = {
    request: "completed",
    documents: "pending",
    videoconference: "pending",
    emission: "pending",
  };

  if (request.status === "rejected") {
    return { ...steps, request: "rejected" };
  }

  // Request is always completed if it exists
  steps.request = "completed";

  // Documents step
  if (["documents_sent", "videoconference_scheduled", "videoconference_completed", "approved", "issued"].includes(request.status)) {
    steps.documents = "completed";
  } else if (request.status === "pending") {
    steps.documents = "current";
  }

  // Videoconference step
  if (request.videoconference_completed || ["approved", "issued"].includes(request.status)) {
    steps.videoconference = "completed";
  } else if (["videoconference_scheduled", "documents_sent"].includes(request.status)) {
    steps.videoconference = "current";
  }

  // Emission step
  if (request.certificate_issued || request.status === "issued") {
    steps.emission = "completed";
  } else if (request.status === "approved") {
    steps.emission = "current";
  }

  return steps;
}

export default function CertificateRequests() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<CertificateRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRequests = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase
        .from("certificate_requests")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (error: any) {
      console.error("Error fetching certificate requests:", error);
      toast.error("Erro ao carregar solicitações");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRequests();

    // Set up real-time subscription
    const channel = supabase
      .channel("certificate-requests-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "certificate_requests",
        },
        (payload) => {
          console.log("Certificate request change:", payload);
          if (payload.eventType === "INSERT") {
            setRequests((prev) => [payload.new as CertificateRequest, ...prev]);
            toast.success("Nova solicitação criada");
          } else if (payload.eventType === "UPDATE") {
            setRequests((prev) =>
              prev.map((req) =>
                req.id === payload.new.id ? (payload.new as CertificateRequest) : req
              )
            );
            toast.info("Status atualizado");
          } else if (payload.eventType === "DELETE") {
            setRequests((prev) => prev.filter((req) => req.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [navigate]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchRequests();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCPF = (cpf: string) => {
    const cleaned = cpf.replace(/\D/g, "");
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  return (
    <Layout>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-sm font-bold text-gray-600">Certificados</h1>
            <p className="text-xs text-gray-500">
              Acompanhe suas solicitações de certificado digital
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button
              size="sm"
              onClick={() => window.open('https://sign.eongerenciamento.com.br/certificados/comprar', '_blank')}
              className="gap-2 bg-gradient-to-r from-[#273d60] to-[#1a2a42]"
            >
              <Award className="h-4 w-4" />
              Comprar Certificado
            </Button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-6">
                <div className="space-y-4">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-32" />
                  <div className="flex gap-2">
                    {[1, 2, 3, 4].map((j) => (
                      <Skeleton key={j} className="h-10 w-10 rounded-full" />
                    ))}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : requests.length === 0 ? (
          <Card className="p-12 text-center">
            <Award className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma solicitação encontrada</h3>
            <p className="text-muted-foreground mb-4">
              Você ainda não possui solicitações de certificado digital.
            </p>
            <Button 
              onClick={() => window.open('https://sign.eongerenciamento.com.br/certificados/comprar', '_blank')}
              className="gap-2 bg-gradient-to-r from-[#273d60] to-[#1a2a42]"
            >
              <Award className="h-4 w-4" />
              Comprar Certificado
            </Button>
          </Card>
        ) : (
          <AnimatePresence>
            <div className="space-y-4">
              {requests.map((request, index) => {
                const statusConfig = STATUS_CONFIG[request.status] || STATUS_CONFIG.pending;
                const StatusIcon = statusConfig.icon;
                const stepStatus = getStepStatus(request);

                return (
                  <motion.div
                    key={request.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card className="p-6 hover:shadow-md transition-shadow">
                      <div className="space-y-4">
                        {/* Header */}
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-foreground">
                                {request.common_name}
                              </h3>
                              <Badge variant="outline" className="text-xs">
                                {request.type === "PJ" ? "Pessoa Jurídica" : "Pessoa Física"}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              CPF: {formatCPF(request.cpf)}
                              {request.protocol && (
                                <span className="ml-3">Protocolo: {request.protocol}</span>
                              )}
                            </p>
                          </div>
                          <Badge className={`${statusConfig.color} border shrink-0`}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusConfig.label}
                          </Badge>
                        </div>

                        {/* Progress Steps */}
                        <div className="flex items-center justify-between py-4">
                          {STEPS.map((step, stepIndex) => {
                            const status = stepStatus[step.key as keyof typeof stepStatus];
                            const StepIcon = step.icon;
                            const isCompleted = status === "completed";
                            const isCurrent = status === "current";
                            const isRejected = status === "rejected";

                            return (
                              <div key={step.key} className="flex items-center flex-1">
                                <div className="flex flex-col items-center">
                                  <motion.div
                                    className={`
                                      w-10 h-10 rounded-full flex items-center justify-center
                                      ${isCompleted ? "bg-green-500 text-white" : ""}
                                      ${isCurrent ? "bg-primary text-primary-foreground ring-4 ring-primary/20" : ""}
                                      ${isRejected ? "bg-red-500 text-white" : ""}
                                      ${!isCompleted && !isCurrent && !isRejected ? "bg-muted text-muted-foreground" : ""}
                                    `}
                                    animate={isCurrent ? { scale: [1, 1.1, 1] } : {}}
                                    transition={{ repeat: Infinity, duration: 2 }}
                                  >
                                    <StepIcon className="h-5 w-5" />
                                  </motion.div>
                                  <span className={`text-xs mt-2 text-center ${isCurrent ? "font-medium text-primary" : "text-muted-foreground"}`}>
                                    {step.label}
                                  </span>
                                </div>
                                {stepIndex < STEPS.length - 1 && (
                                  <div
                                    className={`flex-1 h-1 mx-2 rounded ${
                                      isCompleted ? "bg-green-500" : "bg-muted"
                                    }`}
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Footer */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t">
                          <div className="text-xs text-muted-foreground">
                            <span>Criado em {formatDate(request.created_at)}</span>
                            {request.updated_at !== request.created_at && (
                              <span className="ml-3">
                                Atualizado em {formatDate(request.updated_at)}
                              </span>
                            )}
                          </div>
                          {request.certificate_issued && !request.certificate_downloaded && (
                            <Button size="sm" className="gap-2">
                              <ExternalLink className="h-4 w-4" />
                              Baixar Certificado
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </AnimatePresence>
        )}
      </div>
    </Layout>
  );
}
