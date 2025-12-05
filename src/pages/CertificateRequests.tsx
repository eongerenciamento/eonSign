import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Award, Clock, CheckCircle, FileUp, Video, AlertCircle, RefreshCw, Download, Loader2, FileText, Trash2, Eye, MoreVertical, XCircle, AlertTriangle, ShieldX, CreditCard, Plus, ArrowRight } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { CertificateCheckoutDialog } from "@/components/certificate/CertificateCheckoutDialog";
import { CertificatePurchaseDialog } from "@/components/certificate/CertificatePurchaseDialog";
interface CertificateRequest {
  id: string;
  protocol: string | null;
  type: string;
  status: string;
  payment_status: string | null;
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
  emission_url: string | null;
  rejection_reason: string | null;
  revoked_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}
interface RequestDocument {
  id: string;
  name?: string;
  type?: string;
  created_at?: string;
}
const STATUS_CONFIG: Record<string, {
  label: string;
  color: string;
  icon: React.ElementType;
}> = {
  paid: {
    label: "Pago - Aguardando Início",
    color: "bg-emerald-100 text-emerald-800 border-emerald-300",
    icon: CreditCard
  },
  created: {
    label: "Criada",
    color: "bg-gray-100 text-gray-800 border-gray-300",
    icon: Clock
  },
  pending: {
    label: "Aguardando Documentos",
    color: "bg-yellow-100 text-yellow-800 border-yellow-300",
    icon: FileUp
  },
  documents_sent: {
    label: "Documentos Enviados",
    color: "bg-blue-100 text-blue-800 border-blue-300",
    icon: Clock
  },
  videoconference_scheduled: {
    label: "Videoconferência Agendada",
    color: "bg-purple-100 text-purple-800 border-purple-300",
    icon: Video
  },
  videoconference_completed: {
    label: "Videoconferência Concluída",
    color: "bg-indigo-100 text-indigo-800 border-indigo-300",
    icon: CheckCircle
  },
  in_validation: {
    label: "Em Validação",
    color: "bg-orange-100 text-orange-800 border-orange-300",
    icon: Clock
  },
  pending_authentication: {
    label: "Aguardando Autenticação",
    color: "bg-amber-100 text-amber-800 border-amber-300",
    icon: Clock
  },
  approved: {
    label: "Aprovado",
    color: "bg-green-100 text-green-800 border-green-300",
    icon: CheckCircle
  },
  issued: {
    label: "Certificado Emitido",
    color: "bg-emerald-100 text-emerald-800 border-emerald-300",
    icon: Award
  },
  rejected: {
    label: "Rejeitado",
    color: "bg-red-100 text-red-800 border-red-300",
    icon: XCircle
  },
  validation_rejected: {
    label: "Validação Rejeitada",
    color: "bg-orange-100 text-orange-800 border-orange-300",
    icon: AlertTriangle
  },
  revoked: {
    label: "Revogado",
    color: "bg-red-100 text-red-800 border-red-300",
    icon: ShieldX
  }
};
const STEPS = [{
  key: "request",
  label: "Solicitação",
  icon: Award
}, {
  key: "documents",
  label: "Documentos",
  icon: FileUp
}, {
  key: "videoconference",
  label: "Videoconferência",
  icon: Video
}, {
  key: "emission",
  label: "Emissão",
  icon: CheckCircle
}];
function getStepStatus(request: CertificateRequest) {
  const steps = {
    request: "completed",
    documents: "pending",
    videoconference: "pending",
    emission: "pending"
  };
  if (request.status === "rejected" || request.status === "revoked") {
    return {
      ...steps,
      request: "rejected"
    };
  }
  if (request.status === "validation_rejected") {
    steps.request = "completed";
    steps.documents = "warning";
    return steps;
  }
  steps.request = "completed";
  if (["documents_sent", "videoconference_scheduled", "videoconference_completed", "in_validation", "pending_authentication", "approved", "issued"].includes(request.status)) {
    steps.documents = "completed";
  } else if (request.status === "pending" || request.status === "created") {
    steps.documents = "current";
  }
  if (request.videoconference_completed || ["in_validation", "pending_authentication", "approved", "issued"].includes(request.status)) {
    steps.videoconference = "completed";
  } else if (["videoconference_scheduled", "documents_sent"].includes(request.status)) {
    steps.videoconference = "current";
  }
  if (request.certificate_issued || request.status === "issued") {
    steps.emission = "completed";
  } else if (request.status === "approved" || request.status === "pending_authentication") {
    steps.emission = "current";
  }
  return steps;
}
export default function CertificateRequests() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [requests, setRequests] = useState<CertificateRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Checkout dialog state
  const [showCheckoutDialog, setShowCheckoutDialog] = useState(false);

  // Purchase continuation dialog state
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const [continuingRequest, setContinuingRequest] = useState<CertificateRequest | null>(null);

  // Emission iframe state
  const [showEmissionDialog, setShowEmissionDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<CertificateRequest | null>(null);
  const [isEmissionLoading, setIsEmissionLoading] = useState(true);

  // Download state
  const [downloadingProtocol, setDownloadingProtocol] = useState<string | null>(null);

  // Documents state
  const [showDocumentsDialog, setShowDocumentsDialog] = useState(false);
  const [documents, setDocuments] = useState<RequestDocument[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [selectedDocRequest, setSelectedDocRequest] = useState<CertificateRequest | null>(null);

  // Delete states
  const [showDeleteRequestDialog, setShowDeleteRequestDialog] = useState(false);
  const [deletingRequest, setDeletingRequest] = useState<CertificateRequest | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);

  // Sync status state
  const [syncingProtocol, setSyncingProtocol] = useState<string | null>(null);

  // Ownership term download state
  const [downloadingTermProtocol, setDownloadingTermProtocol] = useState<string | null>(null);

  // Handle payment URL parameters
  useEffect(() => {
    const payment = searchParams.get("payment");
    if (payment === "success") {
      toast.success("Pagamento confirmado! Seu certificado será processado.");
      setSearchParams({});
    } else if (payment === "canceled") {
      toast.info("Pagamento cancelado. Você pode tentar novamente.");
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);
  const fetchRequests = async () => {
    try {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      const {
        data,
        error
      } = await supabase.from("certificate_requests").select("*").eq("user_id", user.id).order("created_at", {
        ascending: false
      });
      if (error) throw error;
      setRequests((data || []) as CertificateRequest[]);
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
    const channel = supabase.channel("certificate-requests-changes").on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "certificate_requests"
    }, payload => {
      console.log("Certificate request change:", payload);
      if (payload.eventType === "INSERT") {
        setRequests(prev => [payload.new as CertificateRequest, ...prev]);
        toast.success("Nova solicitação criada");
      } else if (payload.eventType === "UPDATE") {
        setRequests(prev => prev.map(req => req.id === payload.new.id ? payload.new as CertificateRequest : req));
        toast.info("Status atualizado");
      } else if (payload.eventType === "DELETE") {
        setRequests(prev => prev.filter(req => req.id !== payload.old.id));
      }
    }).subscribe();
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
      minute: "2-digit"
    });
  };
  const formatCPF = (cpf: string) => {
    const cleaned = cpf.replace(/\D/g, "");
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };
  const getEmissionUrl = (request: CertificateRequest): string => {
    if (request.emission_url) {
      return request.emission_url;
    }
    const cleanCpf = request.cpf.replace(/\D/g, "");
    return `https://mp-universal.hom.bry.com.br/protocolo/emissao?cpf=${cleanCpf}&protocolo=${request.protocol}`;
  };
  const handleOpenEmission = (request: CertificateRequest) => {
    setSelectedRequest(request);
    setIsEmissionLoading(true);
    setShowEmissionDialog(true);
  };
  const handleCloseEmission = () => {
    setShowEmissionDialog(false);
    setSelectedRequest(null);
    setIsEmissionLoading(true);
  };
  const handleDownloadCertificate = async (request: CertificateRequest) => {
    if (!request.protocol) {
      toast.error("Protocolo não encontrado");
      return;
    }
    setDownloadingProtocol(request.protocol);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke("bry-ar-download-certificate", {
        body: {
          protocol: request.protocol
        }
      });
      if (error) throw error;
      if (!data.success) {
        toast.error(data.error || "Erro ao baixar certificado");
        return;
      }
      if (!data.pfx_data) {
        toast.error("Certificado ainda não está disponível para download");
        return;
      }
      const byteCharacters = atob(data.pfx_data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], {
        type: "application/x-pkcs12"
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${data.common_name || request.common_name}.pfx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      if (data.pfx_password) {
        toast.success(`Certificado baixado! Senha: ${data.pfx_password}`, {
          duration: 10000
        });
      } else {
        toast.success("Certificado baixado com sucesso!");
      }
      await supabase.from("certificate_requests").update({
        certificate_downloaded: true
      }).eq("protocol", request.protocol);
    } catch (error: any) {
      console.error("Error downloading certificate:", error);
      toast.error(error.message || "Erro ao baixar certificado");
    } finally {
      setDownloadingProtocol(null);
    }
  };

  // Sync status manually
  const handleSyncStatus = async (request: CertificateRequest) => {
    if (!request.protocol) {
      toast.error("Protocolo não encontrado");
      return;
    }
    setSyncingProtocol(request.protocol);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke("bry-ar-get-request", {
        body: {
          protocol: request.protocol
        }
      });
      if (error) throw error;
      if (!data.success) {
        throw new Error(data.error || "Erro ao sincronizar status");
      }
      toast.success("Status sincronizado com sucesso");
      fetchRequests();
    } catch (error: any) {
      console.error("Error syncing status:", error);
      toast.error(error.message || "Erro ao sincronizar status");
    } finally {
      setSyncingProtocol(null);
    }
  };

  // Download ownership term
  const handleDownloadOwnershipTerm = async (request: CertificateRequest) => {
    if (!request.protocol) {
      toast.error("Protocolo não encontrado");
      return;
    }
    setDownloadingTermProtocol(request.protocol);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke("bry-ar-download-ownership-term", {
        body: {
          protocol: request.protocol
        }
      });
      if (error) throw error;
      if (!data.success) {
        throw new Error(data.error || "Erro ao baixar termo de titularidade");
      }
      const byteCharacters = atob(data.pdf_data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], {
        type: "application/pdf"
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename || `termo_titularidade_${request.protocol}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Termo de titularidade baixado com sucesso!");
    } catch (error: any) {
      console.error("Error downloading ownership term:", error);
      toast.error(error.message || "Erro ao baixar termo de titularidade");
    } finally {
      setDownloadingTermProtocol(null);
    }
  };

  // List documents for a request
  const handleListDocuments = async (request: CertificateRequest) => {
    if (!request.protocol) {
      toast.error("Protocolo não encontrado");
      return;
    }
    setSelectedDocRequest(request);
    setLoadingDocuments(true);
    setShowDocumentsDialog(true);
    setDocuments([]);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke("bry-ar-list-documents", {
        body: {
          protocol: request.protocol
        }
      });
      if (error) throw error;
      if (!data.success) {
        throw new Error(data.error || "Erro ao listar documentos");
      }
      setDocuments(data.documents || []);
    } catch (error: any) {
      console.error("Error listing documents:", error);
      toast.error(error.message || "Erro ao listar documentos");
    } finally {
      setLoadingDocuments(false);
    }
  };

  // View/download a specific document
  const handleViewDocument = async (doc: RequestDocument) => {
    if (!selectedDocRequest?.protocol) return;
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke("bry-ar-get-document", {
        body: {
          protocol: selectedDocRequest.protocol,
          documentId: doc.id
        }
      });
      if (error) throw error;
      if (!data.success) {
        throw new Error(data.error || "Erro ao obter documento");
      }

      // If document has content (base64), download it
      if (data.document?.content) {
        const byteCharacters = atob(data.document.content);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray]);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = doc.name || `documento_${doc.id}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Documento baixado!");
      } else {
        toast.info("Documento visualizado com sucesso");
      }
    } catch (error: any) {
      console.error("Error viewing document:", error);
      toast.error(error.message || "Erro ao visualizar documento");
    }
  };

  // Delete a specific document
  const handleDeleteDocument = async (doc: RequestDocument) => {
    if (!selectedDocRequest?.protocol) return;
    setDeletingDocId(doc.id);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke("bry-ar-delete-document", {
        body: {
          protocol: selectedDocRequest.protocol,
          documentId: doc.id
        }
      });
      if (error) throw error;
      if (!data.success) {
        throw new Error(data.error || "Erro ao excluir documento");
      }
      setDocuments(prev => prev.filter(d => d.id !== doc.id));
      toast.success("Documento excluído com sucesso");
    } catch (error: any) {
      console.error("Error deleting document:", error);
      toast.error(error.message || "Erro ao excluir documento");
    } finally {
      setDeletingDocId(null);
    }
  };

  // Delete certificate request
  const handleDeleteRequest = async () => {
    if (!deletingRequest?.protocol) return;
    setIsDeleting(true);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke("bry-ar-delete-request", {
        body: {
          protocol: deletingRequest.protocol
        }
      });
      if (error) throw error;
      if (!data.success) {
        throw new Error(data.error || "Erro ao excluir solicitação");
      }
      setRequests(prev => prev.filter(r => r.id !== deletingRequest.id));
      toast.success("Solicitação excluída com sucesso");
      setShowDeleteRequestDialog(false);
      setDeletingRequest(null);
    } catch (error: any) {
      console.error("Error deleting request:", error);
      const errorMessage = error.message?.includes("não permite exclusão") ? "Esta solicitação não pode ser excluída pois já está em processamento na certificadora." : error.message || "Erro ao excluir solicitação";
      toast.error(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };
  const canDeleteRequest = (request: CertificateRequest) => {
    return ["pending", "documents_sent", "created", "paid"].includes(request.status);
  };
  const handleContinueProcess = (request: CertificateRequest) => {
    setContinuingRequest(request);
    setShowPurchaseDialog(true);
  };
  return <Layout>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-sm font-bold text-gray-600">Certificados</h1>
            <p className="text-xs text-gray-500">
              Acompanhe suas solicitações de certificado digital
            </p>
          </div>
          <div className="flex gap-2 text-primary-foreground bg-transparent">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="gap-2 rounded-full text-gray-600 bg-gray-200 hover:bg-gray-100 border-0 border-none">
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            
          </div>
        </div>

        {/* Content */}
        {loading ? <div className="space-y-4">
            {[1, 2, 3].map(i => <Card key={i} className="p-6">
                <div className="space-y-4">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-32" />
                  <div className="flex gap-2">
                    {[1, 2, 3, 4].map(j => <Skeleton key={j} className="h-10 w-10 rounded-full" />)}
                  </div>
                </div>
              </Card>)}
          </div> : requests.length === 0 ? <Card className="p-12 text-center">
            <Award className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma solicitação encontrada</h3>
            <p className="text-muted-foreground mb-4">
              Você ainda não possui solicitações de certificado digital.
            </p>
            <Button onClick={() => setShowCheckoutDialog(true)} className="gap-2 bg-gradient-to-r from-[#273d60] to-[#001a4d]">
              <Plus className="h-4 w-4" />
              Comprar Certificado
            </Button>
          </Card> : <AnimatePresence>
            <div className="space-y-4">
              {requests.map((request, index) => {
            const statusConfig = STATUS_CONFIG[request.status] || STATUS_CONFIG.pending;
            const StatusIcon = statusConfig.icon;
            const stepStatus = getStepStatus(request);
            const isDownloading = downloadingProtocol === request.protocol;
            const isSyncing = syncingProtocol === request.protocol;
            const isDownloadingTerm = downloadingTermProtocol === request.protocol;
            return <motion.div key={request.id} initial={{
              opacity: 0,
              y: 20
            }} animate={{
              opacity: 1,
              y: 0
            }} exit={{
              opacity: 0,
              y: -20
            }} transition={{
              delay: index * 0.1
            }}>
                    <Card className="p-6 hover:shadow-md transition-shadow">
                      <div className="space-y-4">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-4">
                          {/* Left side - Info */}
                          <div className="flex-shrink-0">
                            <h3 className="font-semibold bg-transparent text-gray-600 mb-1 text-sm">
                              {request.common_name}
                            </h3>
                            <p className="text-xs text-muted-foreground mb-1">
                              Certificado Digital A1
                            </p>
                            <p className="text-sm text-muted-foreground">
                              <span className="font-bold">{request.type === "PJ" ? "CNPJ" : "CPF"}:</span> {request.type === "PJ" && request.cnpj ? request.cnpj : formatCPF(request.cpf)}
                            </p>
                            {request.protocol && <p className="text-sm text-muted-foreground">
                                <span className="font-bold">Protocolo:</span> {request.protocol}
                              </p>}
                            <p className="text-xs text-muted-foreground mt-1">
                              Criado em {formatDate(request.created_at)}
                            </p>
                            <Badge className={`${statusConfig.color} border-0 mt-2`}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {statusConfig.label}
                            </Badge>
                          </div>
                          
                          {/* Center - Progress Steps */}
                          <div className="flex-1 flex items-center justify-end">
                            <div className="flex items-center">
                              {STEPS.map((step, stepIndex) => {
                          const status = stepStatus[step.key as keyof typeof stepStatus];
                          const StepIcon = step.icon;
                          const isCompleted = status === "completed";
                          const isCurrent = status === "current";
                          const isRejected = status === "rejected";
                          const isWarning = status === "warning";
                          return <div key={step.key} className="flex items-center">
                                  <div className="flex flex-col items-center">
                                    <motion.div className={`
                                        w-10 h-10 rounded-full flex items-center justify-center
                                        ${isCompleted ? "bg-green-500 text-white" : ""}
                                        ${isCurrent ? "bg-blue-700 text-white ring-4 ring-blue-700/20" : ""}
                                        ${isRejected ? "bg-red-500 text-white" : ""}
                                        ${isWarning ? "bg-orange-500 text-white" : ""}
                                        ${!isCompleted && !isCurrent && !isRejected && !isWarning ? "bg-muted text-muted-foreground" : ""}
                                      `} animate={isCurrent ? {
                                scale: [1, 1.1, 1]
                              } : {}} transition={{
                                repeat: Infinity,
                                duration: 2
                              }}>
                                      <StepIcon className="h-5 w-5" />
                                    </motion.div>
                                    <span className={`text-xs mt-2 text-center ${isCurrent ? "font-medium text-primary" : "text-muted-foreground"}`}>
                                      {step.label}
                                    </span>
                                  </div>
                                  {stepIndex < STEPS.length - 1 && <div className={`w-10 h-0.5 mx-2 rounded ${isCompleted ? "bg-green-500" : isWarning ? "bg-orange-500" : "bg-muted"}`} />}
                                </div>;
                        })}
                            </div>
                          </div>
                          
                          {/* Right side - Actions dropdown */}
                          <div className="flex-shrink-0">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="h-8 w-8 rounded-full flex items-center justify-center text-gray-500">
                                  <MoreVertical className="h-4 w-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-background">
                                <DropdownMenuItem onClick={() => handleSyncStatus(request)} disabled={isSyncing} className="focus:bg-transparent focus:text-foreground">
                                  <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
                                  Sincronizar Status
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleListDocuments(request)} className="focus:bg-transparent focus:text-foreground">
                                  <FileText className="h-4 w-4 mr-2" />
                                  Ver Documentos
                                </DropdownMenuItem>
                                {request.status === "approved" && <DropdownMenuItem onClick={() => handleDownloadOwnershipTerm(request)} disabled={isDownloadingTerm} className="focus:bg-transparent focus:text-foreground">
                                    {isDownloadingTerm ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                                    Termo de Titularidade
                                  </DropdownMenuItem>}
                                {canDeleteRequest(request) && <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => {
                              setDeletingRequest(request);
                              setShowDeleteRequestDialog(true);
                            }} className="text-destructive focus:bg-transparent focus:text-destructive">
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Excluir Solicitação
                                    </DropdownMenuItem>
                                  </>}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>

                        {/* Rejection/Validation Alert */}
                        {(request.status === "rejected" || request.status === "validation_rejected") && <Alert variant={request.status === "rejected" ? "destructive" : "default"} className="border-orange-300 bg-orange-50">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                              {request.status === "rejected" ? <>
                                  <strong>Solicitação rejeitada.</strong>
                                  {request.rejection_reason && <span className="block mt-1">Motivo: {request.rejection_reason}</span>}
                                </> : <>
                                  <strong>Validação devolvida pela central.</strong>
                                  <span className="block mt-1">Por favor, verifique os documentos enviados e faça as correções necessárias.</span>
                                </>}
                            </AlertDescription>
                          </Alert>}

                        {/* Revoked Alert */}
                        {request.status === "revoked" && <Alert variant="destructive">
                            <ShieldX className="h-4 w-4" />
                            <AlertDescription>
                              <strong>Certificado revogado.</strong>
                              {request.revoked_at && <span className="block mt-1">Revogado em: {formatDate(request.revoked_at)}</span>}
                            </AlertDescription>
                          </Alert>}

                        {/* Footer */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3 -mt-4">
                          <div className="flex gap-2">
                            {/* Continue process button - when paid */}
                            {request.status === "paid" && <motion.div animate={{
                        scale: [1, 1.05, 1]
                      }} transition={{
                        repeat: Infinity,
                        duration: 2
                      }}>
                              <Button size="sm" onClick={() => handleContinueProcess(request)} className="gap-1 text-xs px-3 py-1 h-7 bg-blue-700 hover:bg-blue-800 rounded-full border-4 border-input">
                                <ArrowRight className="h-3 w-3" />
                                Continuar Processo
                              </Button>
                            </motion.div>}

                            {/* Ownership term button - when approved */}
                            {request.status === "approved" && <Button size="sm" variant="outline" onClick={() => handleDownloadOwnershipTerm(request)} disabled={isDownloadingTerm} className="gap-2">
                                {isDownloadingTerm ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                                Termo de Titularidade
                              </Button>}
                            
                            {/* Emission button - when approved */}
                            {request.status === "approved" && <Button size="sm" onClick={() => handleOpenEmission(request)} className="gap-2 bg-gradient-to-r from-[#273d60] to-[#001a4d]">
                                <Award className="h-4 w-4" />
                                Emitir Certificado
                              </Button>}
                            
                            {/* Download button - when issued */}
                            {request.certificate_issued && <Button size="sm" onClick={() => handleDownloadCertificate(request)} disabled={isDownloading} className="gap-2" variant={request.certificate_downloaded ? "outline" : "default"}>
                                {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                {request.certificate_downloaded ? "Baixar Novamente" : "Baixar Certificado"}
                              </Button>}
                          </div>
                        </div>
                      </div>
                    </Card>
                  </motion.div>;
          })}
            </div>
          </AnimatePresence>}
      </div>

      {/* Emission Iframe Dialog */}
      <Dialog open={showEmissionDialog} onOpenChange={setShowEmissionDialog}>
        <DialogContent className="max-w-[95vw] w-[1200px] h-[90vh] p-0 flex flex-col">
          <div className="flex items-center justify-between p-4 border-b">
            <div>
              <h2 className="text-lg font-semibold">Emissão do Certificado</h2>
              <p className="text-xs text-muted-foreground">
                {selectedRequest?.common_name} - Protocolo: {selectedRequest?.protocol}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCloseEmission}>
                Fechar
              </Button>
              <Button size="sm" onClick={() => {
              handleCloseEmission();
              fetchRequests();
            }} className="bg-gradient-to-r from-[#273d60] to-[#001a4d]">
                <CheckCircle className="w-4 h-4 mr-2" />
                Concluir Emissão
              </Button>
            </div>
          </div>
          <div className="relative flex-1 w-full min-h-0">
            {isEmissionLoading && <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Carregando ambiente de emissão...</p>
                </div>
              </div>}
            {selectedRequest && <iframe src={getEmissionUrl(selectedRequest)} className="w-full h-full border-0" style={{
            minHeight: "calc(90vh - 80px)"
          }} allow="camera; microphone" onLoad={() => setIsEmissionLoading(false)} />}
          </div>
        </DialogContent>
      </Dialog>

      {/* Documents Dialog */}
      <Dialog open={showDocumentsDialog} onOpenChange={setShowDocumentsDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Documentos da Solicitação</DialogTitle>
            <DialogDescription>
              {selectedDocRequest?.common_name} - Protocolo: {selectedDocRequest?.protocol}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {loadingDocuments ? <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div> : documents.length === 0 ? <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Nenhum documento encontrado</p>
              </div> : documents.map(doc => <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{doc.name || `Documento ${doc.id}`}</p>
                      {doc.type && <p className="text-xs text-muted-foreground">{doc.type}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleViewDocument(doc)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    {selectedDocRequest && canDeleteRequest(selectedDocRequest) && <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteDocument(doc)} disabled={deletingDocId === doc.id}>
                        {deletingDocId === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </Button>}
                  </div>
                </div>)}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDocumentsDialog(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Request Confirmation Dialog */}
      <AlertDialog open={showDeleteRequestDialog} onOpenChange={setShowDeleteRequestDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Solicitação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a solicitação de certificado de{" "}
              <strong>{deletingRequest?.common_name}</strong>?
              <br />
              <br />
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRequest} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting ? <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Excluindo...
                </> : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Certificate Checkout Dialog */}
      <CertificateCheckoutDialog open={showCheckoutDialog} onOpenChange={setShowCheckoutDialog} />

      {/* Certificate Purchase Dialog - for continuing paid certificates */}
      {continuingRequest && <CertificatePurchaseDialog open={showPurchaseDialog} onOpenChange={open => {
      setShowPurchaseDialog(open);
      if (!open) setContinuingRequest(null);
    }} prefillData={{
      name: continuingRequest.common_name,
      cpf: continuingRequest.cpf,
      email: continuingRequest.email,
      phone: continuingRequest.phone,
      birthDate: continuingRequest.birth_date,
      type: continuingRequest.type as "PF" | "PJ",
      cnpj: continuingRequest.cnpj || undefined,
      responsibleName: continuingRequest.responsible_name || undefined,
      certificateRequestId: continuingRequest.id
    }} />}
    </Layout>;
}